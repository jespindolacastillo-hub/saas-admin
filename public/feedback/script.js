// ─── Supabase Configuration ──────────────────────────────────────────────────
// IANPS Universal Feedback Hub
const supabaseUrl = 'https://qdbosheknbgyqhtoxmfv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYm9zaGVrbmJneXFodG94bWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzU4MzAsImV4cCI6MjA4ODkxMTgzMH0.x1QtKn5dXj30gH7e-w31OrkrSBfIQS9hr2Yiq9Rlxik';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let currentTenantId = null;

// ─── Branding Fallback ───────────────────────────────────────────────────────
const defaultBranding = {
    name: 'IANPS',
    logo_url: '/logo.png', // Logo por defecto de IANPS
    primary_color: '#1e40af'
};

function applyBranding(tenant) {
    const branding = tenant || defaultBranding;
    console.log('Aplicando branding:', branding);
    
    document.title = `${branding.name} | Feedback`;
    
    const logoEl = document.getElementById('brandLogo');
    if (logoEl) {
        // Si el tenant tiene logo_url usarlo, si no el por defecto
        logoEl.src = branding.logo_url || defaultBranding.logo_url;
        logoEl.alt = branding.name;
    }
    
    const footerNameEl = document.getElementById('brandNameFooter');
    if (footerNameEl) {
        footerNameEl.textContent = branding.name;
    }
    
    const color = branding.primary_color || defaultBranding.primary_color;
    document.documentElement.style.setProperty('--primary', color);
    
    const style = document.createElement('style');
    style.id = 'dynamic-branding-styles';
    style.innerHTML = `
        .btn-submit { background: ${color} !important; }
        .option-btn.selected { background: ${color} !important; color: white !important; }
        .emoji-btn.selected { border-color: ${color} !important; background: ${color}11 !important; }
    `;
    // Evitar duplicar estilos
    const existingStyle = document.getElementById('dynamic-branding-styles');
    if (existingStyle) existingStyle.remove();
    document.head.appendChild(style);
}

// ─── Fingerprinting Utility ──────────────────────────────────────────────────
async function getFingerprint() {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
        !!window.indexedDB
    ];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("IANPS_Fingerprint", 2, 15);
    components.push(canvas.toDataURL());

    const str = components.join('###');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'ps_' + Math.abs(hash).toString(16);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Aplicar branding por defecto de inmediato para quitar el de Price Shoes rápido
    applyBranding(null);

    const urlParams = new URLSearchParams(window.location.search);
    let storeId = urlParams.get('t') || urlParams.get('tienda_id') || '';
    let areaId = urlParams.get('a') || urlParams.get('area_id') || '';
    let qrId = urlParams.get('id_qr') || '';

    // PERSISTENCIA
    if (storeId) localStorage.setItem('ps_store_id', storeId);
    else storeId = localStorage.getItem('ps_store_id') || '';

    if (areaId) localStorage.setItem('ps_area_id', areaId);
    else areaId = localStorage.getItem('ps_area_id') || '';

    if (qrId) localStorage.setItem('ps_qr_id', qrId);
    else qrId = localStorage.getItem('ps_qr_id') || '';

    console.log('Contexto detectado:', { storeId, areaId, qrId });

    if (!storeId || !areaId) {
        document.getElementById('display_store').textContent = '⚠️ Enlace incompleto';
        document.getElementById('display_area').textContent = 'Escanee el QR nuevamente';
        return;
    }

    // 1. Fetch Dynamic Branding & Store Info
    try {
        // A. Obtener datos de la tienda
        console.log('Buscando tienda:', storeId);
        const { data: store, error: storeErr } = await _supabase
            .from('Tiendas_Catalogo')
            .select('nombre, tenant_id')
            .eq('id', storeId)
            .single();

        if (storeErr) {
            console.warn('Error al buscar tienda o RLS bloqueando:', storeErr);
            // Si falla por RLS, no lanzamos error fatal pero el branding seguirá en default
        }
        
        if (store) {
            currentTenantId = store.tenant_id;
            document.getElementById('display_store').textContent = store.nombre;
            console.log('Tienda encontrada:', store.nombre, 'Tenant:', currentTenantId);

            // B. Obtener Branding del Tenant si tenemos tenantId
            if (currentTenantId) {
                const { data: tenant, error: tenantErr } = await _supabase
                    .from('tenants')
                    .select('name, logo_url, primary_color')
                    .eq('id', currentTenantId)
                    .single();

                if (!tenantErr && tenant) {
                    applyBranding(tenant);
                } else {
                    console.warn('Error cargando branding o RLS:', tenantErr);
                }
            }
        }

        // C. Obtener el área
        const { data: area } = await _supabase
            .from('Areas_Catalogo')
            .select('nombre')
            .eq('id', areaId)
            .single();
        
        if (area) {
            document.getElementById('display_area').textContent = area.nombre;
            console.log('Área encontrada:', area.nombre);
        } else {
            document.getElementById('display_area').textContent = 'Área desconocida';
        }

        // D. Cargar pregunta dinámica
        if (areaId) loadDynamicQuestion(areaId);

    } catch (err) {
        console.error('Error cargando configuración dinámica:', err);
    }

    // 2. Browser Fingerprinting
    const deviceId = await getFingerprint();
    const deviceInfoEl = document.getElementById('device_info');
    if (deviceInfoEl) deviceInfoEl.textContent = `Device: ${deviceId}`;

    // Master Mode
    const masterBypassBtn = document.getElementById('masterBypassBtn');
    let isMasterMode = localStorage.getItem('ps_master_mode') === 'active';
    if (isMasterMode && masterBypassBtn) masterBypassBtn.classList.add('active');

    if (masterBypassBtn) {
        masterBypassBtn.addEventListener('click', () => {
            const pass = prompt('Modo Maestro - Ingrese contraseña:');
            if (pass === '1972') {
                localStorage.setItem('ps_master_mode', 'active');
                isMasterMode = true;
                masterBypassBtn.classList.add('active');
                alert('¡Modo Maestro Activado!');
                window.location.reload();
            }
        });
    }

    // Cooldown
    if (!isMasterMode) {
        const lastSent = localStorage.getItem(`feedback_sent_${storeId}_${areaId}`);
        if (lastSent && (Date.now() - parseInt(lastSent) < 12 * 60 * 60 * 1000)) {
            document.getElementById('feedbackForm').style.display = 'none';
            document.getElementById('cooldownMessage').style.display = 'block';
            return;
        }
    }

    // 3. Form Submission Logic
    setupFormSubmission(deviceId, storeId, areaId, qrId);
});

function setupFormSubmission(deviceId, storeId, areaId, qrId) {
    const feedbackForm = document.getElementById('feedbackForm');
    const emojiBtns = document.querySelectorAll('.emoji-btn');
    const satisfaccionInput = document.getElementById('satisfaccionInput');
    const detractorSection = document.getElementById('detractorSection');

    emojiBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            emojiBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const val = parseInt(btn.dataset.value);
            satisfaccionInput.value = val;
            if (val <= 2) {
                detractorSection.style.display = 'block';
                document.getElementById('extraInfo').required = true;
            } else {
                detractorSection.style.display = 'none';
                document.getElementById('extraInfo').required = false;
            }
        });
    });

    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = parseInt(satisfaccionInput.value);
        if (!rating) { alert('Selecciona una calificación'); return; }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.querySelector('.loader').style.display = 'inline-block';
        submitBtn.querySelector('span').innerText = 'Enviando...';

        const payload = {
            id_qr: qrId,
            tienda_id: storeId,
            area_id: areaId,
            satisfaccion: rating,
            calidad_info: document.getElementById('dynamicQuestionInput')?.value || '',
            comentario: document.getElementById('extraInfo')?.value || '',
            device_id: deviceId,
            tenant_id: currentTenantId || '00000000-0000-0000-0000-000000000000'
        };

        try {
            const { data: feedback, error } = await _supabase.from('Feedback').insert([payload]).select();
            if (error) throw error;

            if (rating <= 2 && feedback && feedback.length > 0) {
                try {
                    const whatsapp = document.getElementById('whatsapp')?.value || '';
                    const email = document.getElementById('email')?.value || '';
                    const contactInfo = [whatsapp, email].filter(Boolean).join(' | ') || 'No proporcionado';

                    await _supabase.from('Issues').insert([{
                        feedback_id: feedback[0].id,
                        titulo: `Feedback Crítico: ${rating} Estrellas`,
                        descripcion: `Comentario: ${payload.comentario}\nContacto: ${contactInfo}`,
                        categoria: 'Servicio',
                        severidad: rating === 1 ? 'Crítica' : 'Alta',
                        tienda_id: storeId,
                        area_id: areaId,
                        tenant_id: payload.tenant_id
                    }]);
                } catch (issueErr) {
                    console.warn('No se pudo crear el Issue automático, pero el Feedback se guardó:', issueErr);
                }
            }

            localStorage.setItem(`feedback_sent_${storeId}_${areaId}`, Date.now().toString());
            feedbackForm.style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('Error enviando feedback:', err);
            alert('Error al enviar: ' + err.message);
            submitBtn.disabled = false;
            submitBtn.querySelector('.loader').style.display = 'none';
            submitBtn.querySelector('span').innerText = 'Enviar opinión';
        }
    });
}

async function loadDynamicQuestion(areaId) {
    try {
        const { data, error } = await _supabase
            .from('Area_Preguntas')
            .select('*')
            .eq('area_id', areaId)
            .eq('numero_pregunta', 2)
            .eq('activa', true)
            .eq('tenant_id', currentTenantId || '00000000-0000-0000-0000-000000000000')
            .single();

        if (!data || error) return;

        const container = document.getElementById('dynamicQuestionContainer');
        const label = document.getElementById('dynamicQuestionLabel');
        const optionsContainer = document.getElementById('dynamicQuestionOptions');
        const input = document.getElementById('dynamicQuestionInput');

        container.style.display = 'block';
        label.textContent = `2. ${data.texto_pregunta}`;

        if (data.tipo_respuesta === 'si_no') {
            optionsContainer.innerHTML = `
                <button type="button" class="option-btn dynamic-option" data-value="Sí">Sí</button>
                <button type="button" class="option-btn dynamic-option" data-value="No">No</button>
            `;
        } else if (data.tipo_respuesta === 'multiple' && data.opciones) {
            const opciones = typeof data.opciones === 'string' ? JSON.parse(data.opciones) : data.opciones;
            optionsContainer.innerHTML = opciones.map(opcion =>
                `<button type="button" class="option-btn dynamic-option" data-value="${opcion}">${opcion}</button>`
            ).join('');
        }

        const dynamicBtns = document.querySelectorAll('.dynamic-option');
        dynamicBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                dynamicBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                input.value = btn.dataset.value;
            });
        });
    } catch (e) { console.error(e); }
}
