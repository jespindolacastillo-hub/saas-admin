import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, CheckCircle2, TrendingUp, MessageSquare, Store, Car, Stethoscope, Award, Loader2 } from 'lucide-react';

const T = {
  coral:  '#FF5C3A', teal:  '#00C9A7',
  ink:    '#0A0A0F', card:  '#15151B', border: '#2A2A35',
  muted:  '#8B8B9B', white: '#FFFFFF'
};

const VERTICALS = {
  RESTAURANT: {
    id: 'RESTAURANT', label: 'Restaurantes', icon: <Store size={18} />,
    headline: '¿Cuántas cuentas cobradas salieron hoy sin reseña — o peor, enojados?',
    pains: [
      'Solo el 8% de tus comensales felices deja reseña. El resto se va en silencio.',
      '1 mala experiencia pública anula el impacto de 3 recomendaciones positivas.',
      'Enterarte por TripAdvisor que el salmón salió crudo, es darte cuenta demasiado tarde.'
    ],
    pitch: 'Retelio te manda una alerta por WhatsApp antes de que el comensal molesto cruce la puerta. A los que salen felices, los envía automáticamente a dejarte 5★ en Google Maps.',
    defTraffic: 4500, defTicket: 350
  },
  RETAIL: {
    id: 'RETAIL', label: 'Retail & Tiendas', icon: <Store size={18} />,
    headline: 'Tráfico masivo de mostrador, pero nula fidelización en línea.',
    pains: [
      'El cliente que pasa por tu calle entra al local con 4.8★, no al tuyo de 4.2★.',
      'Cientos de transacciones diarias, cero impacto en tu SEO local.',
      'Tus compradores impulsivos aman tu producto pero se olvidan de promocionarte.'
    ],
    pitch: 'Atrapa la emoción de compra: Retelio escanea a tu comprador y lo convierte en una reseña automática que vuelve a tu marca la Opción #1 en un radio de 5km.',
    defTraffic: 8000, defTicket: 450
  },
  AUTO: {
    id: 'AUTO', label: 'Automotriz', icon: <Car size={18} />,
    headline: 'Nadie le deja su auto a un taller con menos de 4.5 Estrellas.',
    pains: [
      'Un solo cliente molesto por un presupuesto no claro y te hunde en Facebook.',
      'Tu ticket promedio es muy alto ($5k-$50k). El prospecto no arriesga si hay quejas públicas.',
      'Haces servicios de lujo y tus mecánicos son genios, pero Google Maps sigue vacío.'
    ],
    pitch: 'Vendes confianza ciega. Retelio captura las dudas en privado antes de que tu cliente se moleste, y presume a los clientes tranquilos en la plaza pública de Google.',
    defTraffic: 300, defTicket: 6500
  },
  HEALTH: {
    id: 'HEALTH', label: 'Clínicas', icon: <Stethoscope size={18} />,
    headline: 'Tus pacientes buscan tu reputación médica antes de agendar.',
    pains: [
      'Un atraso de 15 minutos en recepción genera quejas públicas que espantan nuevos pacientes.',
      'La salud es pura confianza. Tu título médico no sirve si tu perfil online dice 3.8★.',
      'Los pacientes ya sanos, jamás vuelven a loguearse para dejarte una reseña.'
    ],
    pitch: 'Cerremos la válvula de quejas de recepción en privado, y construyamos el SEO de tu consultorio canalizando masivamente a los pacientes satisfechos hacia Google.',
    defTraffic: 500, defTicket: 1200
  }
};

export default function PartnerLanding() {
  const { codigo } = useParams();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [activeV, setActiveV] = useState('RESTAURANT');
  const vert = VERTICALS[activeV];

  const [traffic, setTraffic] = useState(0);
  const [ticket, setTicket] = useState(0);

  useEffect(() => {
    if (vert) {
      setTraffic(vert.defTraffic);
      setTicket(vert.defTicket);
    }
  }, [activeV]);

  useEffect(() => {
    async function load() {
      if (!codigo) return;
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .eq('code', codigo)
        .eq('active', true)
        .single();
      
      if (error || !data) {
        setError(true);
      } else {
        setPartner(data);
      }
      setLoading(false);
    }
    load();
  }, [codigo]);

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><Loader2 className="animate-spin text-[#00C9A7]" size={40}/></div>;
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-3xl font-black mb-4">Partner No Encontrado</h1>
          <p className="text-gray-400">Verifica el enlace proporcionado por tu asesor.</p>
        </div>
      </div>
    );
  }

  // Cálculos de la Calculadora de Crecimiento
  const interacciones = Math.round(traffic * 0.20);
  const resenas = Math.round(interacciones * 0.60);
  const rescatados = Math.round(interacciones * 0.15);
  const clientesNuevos = Math.round(resenas * 0.50);
  const revenueTotal = clientesNuevos * ticket;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://retelio.com.mx';
  const waMessage = `¡Hola ${partner.name.split(' ')[0]}! Vi la plataforma de Retelio para mi negocio y quiero iniciar la prueba gratuita de 14 días usando tu enlace de referido.`;
  const waLink = partner.whatsapp ? `https://wa.me/52${partner.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}` : '#';

  return (
    <div className="min-h-screen font-sans" style={{ background: T.ink, color: T.white }}>
      {/* Header Premium */}
      <nav style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${T.border}` }} className="sticky top-0 z-50 px-6 py-4 flex justify-between items-center transition-all">
        <div style={{ fontFamily: 'Outfit', fontWeight: 900, fontSize: 24, letterSpacing: '-1px' }}>
          retelio<span style={{ color: T.coral }}>.</span>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4 text-right">
          <div className="text-sm font-medium text-gray-300">
            Asesor Autorizado: <span className="font-bold text-white">{partner.name}</span>
            {partner.company && <span className="hidden sm:inline"> | {partner.company}</span>}
          </div>
          <Badge>Partner Activo</Badge>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-20 pb-48">
        <div className="text-center mb-16">
          <Badge color={T.teal}>Motor de Crecimiento B2B</Badge>
          <h1 className="text-4xl sm:text-6xl font-black mt-6 mb-6 leading-tight tracking-tight">
            Los clientes insatisfechos se van <br className="hidden sm:block"/> en silencio. <span style={{ color: T.coral }}>Y te cuesta miles.</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto font-medium">
            Selecciona tu industria para descubrir exactamente cuánto dinero estás perdiendo por culpa de una mala reputación online.
          </p>
        </div>

        {/* Cajas Selectoras */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
          {Object.values(VERTICALS).map(v => (
            <button key={v.id} 
              onClick={() => setActiveV(v.id)}
              style={{
                background: activeV === v.id ? T.card : 'transparent',
                border: `1px solid ${activeV === v.id ? T.teal : T.border}`,
                boxShadow: activeV === v.id ? `0 0 40px ${T.teal}20` : 'none'
              }}
              className="flex flex-col items-center gap-3 py-6 rounded-2xl transition-all hover:scale-105"
            >
              <div style={{ color: activeV === v.id ? T.teal : T.muted }}>{v.icon}</div>
              <span className="font-bold text-sm" style={{ color: activeV === v.id ? T.white : T.muted }}>{v.label}</span>
            </button>
          ))}
        </div>

        {/* Brochure Dinámico */}
        <div className="bg-[#15151B] p-8 sm:p-12 rounded-3xl border border-[#2A2A35] shadow-2xl relative overflow-hidden mb-16">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#00C9A7] opacity-5 blur-[120px] rounded-full pointer-events-none"></div>
          
          <h2 className="text-3xl font-black mb-8 leading-tight">{vert.headline}</h2>
          
          <div className="grid sm:grid-cols-2 gap-12">
            <div>
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-6 flex items-center gap-2"><ArrowRight size={14}/> El Problema</h3>
              <ul className="space-y-6">
                {vert.pains.map((p, i) => (
                  <li key={i} className="flex gap-4 text-gray-300">
                    <span className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0 text-sm font-bold">{i+1}</span>
                    <span className="text-sm font-medium leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
               <h3 className="text-sm font-bold text-[#00C9A7] uppercase tracking-widest mb-6 flex items-center gap-2"><CheckCircle2 size={14}/> La Solución Retelio</h3>
               <p className="text-gray-200 font-medium leading-relaxed mb-6 bg-white/5 p-6 rounded-2xl border border-white/10">
                 {vert.pitch}
               </p>
               <div className="space-y-4">
                 <div className="flex items-center gap-3">
                   <div className="bg-[#00C9A7]/20 p-2 rounded-lg text-[#00C9A7]"><MessageSquare size={18}/></div>
                   <span className="text-sm font-bold text-gray-300">Aumenta volumen de reseñas positivas 3.2x</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className="bg-[#FF5C3A]/20 p-2 rounded-lg text-[#FF5C3A]"><TrendingUp size={18}/></div>
                   <span className="text-sm font-bold text-gray-300">Frena el 68% de las quejas públicas</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Calculadora Interactiva */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-2">Calculadora de Crecimiento</h2>
            <p className="text-gray-400">Analiza el retorno según el volumen de tu negocio.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 items-center">
            {/* Controles */}
            <div className="bg-[#15151B] p-8 rounded-3xl border border-[#2A2A35]">
              <div className="mb-8">
                <label className="flex justify-between text-sm font-bold mb-4">
                  <span>Tráfico / Cuentas al Mes</span>
                  <span className="text-[#00C9A7]">{traffic.toLocaleString()} citas</span>
                </label>
                <input type="range" min="100" max="25000" step="50" value={traffic} onChange={(e)=>setTraffic(Number(e.target.value))} 
                  className="w-full accent-[#00C9A7]" />
              </div>
              <div>
                <label className="flex justify-between text-sm font-bold mb-4">
                  <span>Ticket Promedio</span>
                  <span className="text-[#FF5C3A]">${ticket.toLocaleString()} MXN</span>
                </label>
                <input type="range" min="50" max="50000" step="50" value={ticket} onChange={(e)=>setTicket(Number(e.target.value))} 
                  className="w-full accent-[#FF5C3A]" />
              </div>
            </div>

            {/* Resultados */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-gradient-to-br from-[#00C9A7]/20 to-transparent p-6 rounded-3xl border border-[#00C9A7]/30">
                 <div className="text-[#00C9A7] font-black text-4xl mb-1">+{resenas}</div>
                 <div className="text-sm font-bold text-gray-300">Reseñas 5★ / Mes</div>
               </div>
               <div className="bg-gradient-to-br from-[#FF5C3A]/20 to-transparent p-6 rounded-3xl border border-[#FF5C3A]/30">
                 <div className="text-[#FF5C3A] font-black text-4xl mb-1">{rescatados}</div>
                 <div className="text-sm font-bold text-gray-300">Quejas Frenadas</div>
               </div>
               <div className="col-span-2 bg-[#15151B] border border-[#2A2A35] p-8 rounded-3xl text-center">
                  <div className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Ingreso Nuevo Mensual Estimado</div>
                  <div className="text-5xl font-black text-white mb-2">${revenueTotal.toLocaleString()} <span className="text-xl text-gray-500">MXN</span></div>
                  <div className="text-xs text-gray-500 font-medium">Asumiendo que cada nueva reseña 5★ genera 0.5 nuevos clientes al mes.</div>
               </div>
            </div>
          </div>
        </div>

      </main>

      {/* Massive Sticky CTA Footer */}
      <div className="fixed bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-50">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-6 bg-gradient-to-r from-orange-600 to-red-600 rounded-3xl p-6 sm:p-4 shadow-[0_0_60px_rgba(255,92,58,0.3)] items-center justify-between">
          <div className="flex items-center gap-6 text-center sm:text-left">
            <div className="hidden sm:block bg-white p-2 rounded-xl">
               <QRCodeSVG value={`${appUrl}?ref=${partner.code}`} size={70} />
            </div>
            <div>
              <h3 className="text-white font-black text-2xl mb-1">Inicia tu prueba de 14 días.</h3>
              <p className="text-white/80 text-sm font-medium">Sin hardware. Funciona vía QR en menos de 10 minutos.</p>
            </div>
          </div>
          <a href={waLink} target="_blank" rel="noreferrer" 
             className="w-full sm:w-auto bg-[#00C9A7] hover:bg-[#00A98F] text-black font-black text-[15px] py-4 px-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 tracking-wide text-center flex items-center justify-center gap-2">
            Hablar con {partner.name.split(' ')[0]} <MessageSquare size={18} />
          </a>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, color = '#FF5C3A' }) {
  return (
    <span style={{ border: `1px solid ${color}40`, color: color, background: `${color}10`, padding: '4px 12px', borderRadius: '100px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
      {children}
    </span>
  );
}
