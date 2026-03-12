import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Save, X, Edit2, Trash2, Check, AlertCircle, Loader, PlusCircle, MinusCircle, Eye, Copy } from 'lucide-react';

const QuestionManager = () => {
    const [questions, setQuestions] = useState([]);
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [creatingNew, setCreatingNew] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [previewQuestion, setPreviewQuestion] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);

    // Cargar preguntas y áreas
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Cargar áreas
            const { data: areasData, error: areasError } = await supabase
                .from('Areas_Catalogo')
                .select('*')
                .order('orden', { ascending: true });

            if (areasError) throw areasError;
            setAreas(areasData || []);

            // Cargar preguntas con información del área
            const { data: questionsData, error: questionsError } = await supabase
                .from('Area_Preguntas')
                .select(`
                    *,
                    area:Areas_Catalogo(id, nombre, icono, color)
                `)
                .order('orden', { ascending: true });

            if (questionsError) throw questionsError;
            setQuestions(questionsData || []);
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Error al cargar los datos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const initializeNewQuestion = () => {
        setCreatingNew(true);
        setEditingId('new');
        setEditForm({
            area_id: areas[0]?.id || '',
            numero_pregunta: 2,
            texto_pregunta: '',
            tipo_respuesta: 'si_no',
            opciones: [],
            mapeo_calificacion: { 'Sí': 5, 'No': 1 },
            obligatoria: true,
            activa: true,
            orden: questions.length + 1
        });
        setError('');
        setSuccessMessage('');
    };

    const handleEdit = (question) => {
        setEditingId(question.id);
        setCreatingNew(false);
        setEditForm({
            area_id: question.area_id,
            numero_pregunta: question.numero_pregunta,
            texto_pregunta: question.texto_pregunta,
            tipo_respuesta: question.tipo_respuesta,
            opciones: question.opciones || [],
            mapeo_calificacion: question.mapeo_calificacion || getDefaultMapping(question.tipo_respuesta),
            obligatoria: question.obligatoria,
            activa: question.activa,
            orden: question.orden
        });
        setError('');
        setSuccessMessage('');
    };

    const handleDuplicate = (question) => {
        setCreatingNew(true);
        setEditingId('new');
        setEditForm({
            area_id: question.area_id,
            numero_pregunta: question.numero_pregunta,
            texto_pregunta: question.texto_pregunta + ' (Copia)',
            tipo_respuesta: question.tipo_respuesta,
            opciones: question.opciones ? [...question.opciones] : [],
            mapeo_calificacion: question.mapeo_calificacion || getDefaultMapping(question.tipo_respuesta),
            obligatoria: question.obligatoria,
            activa: false, // Inactiva por defecto al duplicar
            orden: questions.length + 1
        });
        setError('');
        setSuccessMessage('');
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePreview = (question) => {
        setPreviewQuestion(question);
        setShowPreview(true);
    };

    const getDefaultMapping = (tipo) => {
        switch (tipo) {
            case 'si_no':
                return { 'Sí': 5, 'No': 1 };
            case 'escala':
                return { min: 1, max: 5 };
            case 'emoji':
                return { min: 1, max: 5 };
            default:
                return null;
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setCreatingNew(false);
        setEditForm({});
        setError('');
    };

    const handleTypeChange = (newType) => {
        const newForm = {
            ...editForm,
            tipo_respuesta: newType,
            mapeo_calificacion: getDefaultMapping(newType)
        };

        // Inicializar opciones para tipo múltiple
        if (newType === 'multiple' && (!editForm.opciones || editForm.opciones.length === 0)) {
            newForm.opciones = [
                { texto: 'Excelente', valor: 5 },
                { texto: 'Bueno', valor: 4 },
                { texto: 'Regular', valor: 3 }
            ];
            newForm.mapeo_calificacion = newForm.opciones;
        }

        setEditForm(newForm);
    };

    const handleAddOption = () => {
        const newOptions = [...(editForm.opciones || []), { texto: '', valor: 3 }];
        setEditForm({
            ...editForm,
            opciones: newOptions,
            mapeo_calificacion: newOptions
        });
    };

    const handleRemoveOption = (index) => {
        const newOptions = editForm.opciones.filter((_, i) => i !== index);
        setEditForm({
            ...editForm,
            opciones: newOptions,
            mapeo_calificacion: newOptions
        });
    };

    const handleOptionChange = (index, field, value) => {
        const newOptions = [...editForm.opciones];
        newOptions[index][field] = field === 'valor' ? parseInt(value) || 1 : value;
        setEditForm({
            ...editForm,
            opciones: newOptions,
            mapeo_calificacion: newOptions
        });
    };

    const handleScaleChange = (field, value) => {
        const newMapping = { ...editForm.mapeo_calificacion };
        newMapping[field] = parseInt(value) || 1;
        setEditForm({
            ...editForm,
            mapeo_calificacion: newMapping
        });
    };

    const handleSave = async (questionId) => {
        if (!editForm.texto_pregunta?.trim()) {
            setError('El texto de la pregunta es obligatorio');
            return;
        }

        if (!editForm.area_id) {
            setError('Debes seleccionar un área');
            return;
        }

        // Validar opciones para tipo múltiple
        if (editForm.tipo_respuesta === 'multiple') {
            if (!editForm.opciones || editForm.opciones.length === 0) {
                setError('Debes agregar al menos una opción');
                return;
            }
            const hasEmptyText = editForm.opciones.some(opt => !opt.texto?.trim());
            if (hasEmptyText) {
                setError('Todas las opciones deben tener texto');
                return;
            }
        }

        // Validar escala
        if (editForm.tipo_respuesta === 'escala') {
            const { min, max } = editForm.mapeo_calificacion;
            if (min >= max) {
                setError('El valor máximo debe ser mayor que el mínimo');
                return;
            }
        }

        setSaving(true);
        setError('');

        try {
            const dataToSave = {
                area_id: editForm.area_id,
                numero_pregunta: editForm.numero_pregunta,
                texto_pregunta: editForm.texto_pregunta.trim(),
                tipo_respuesta: editForm.tipo_respuesta,
                opciones: editForm.tipo_respuesta === 'multiple' ? editForm.opciones : null,
                mapeo_calificacion: editForm.mapeo_calificacion,
                obligatoria: editForm.obligatoria,
                activa: editForm.activa,
                orden: editForm.orden
            };

            if (creatingNew) {
                // Crear nueva pregunta
                const { error: insertError } = await supabase
                    .from('Area_Preguntas')
                    .insert([dataToSave]);

                if (insertError) throw insertError;
                setSuccessMessage('✓ Pregunta creada exitosamente');
            } else {
                // Actualizar pregunta existente
                const { error: updateError } = await supabase
                    .from('Area_Preguntas')
                    .update(dataToSave)
                    .eq('id', questionId);

                if (updateError) throw updateError;
                setSuccessMessage('✓ Pregunta guardada exitosamente');
            }

            setTimeout(() => setSuccessMessage(''), 3000);
            setEditingId(null);
            setCreatingNew(false);
            setEditForm({});
            await loadData();
        } catch (err) {
            console.error('Error saving question:', err);
            setError('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (questionId, areaName) => {
        // Mostrar modal de confirmación personalizado
        setDeleteConfirmation({
            questionId,
            areaName
        });
    };

    const confirmDelete = async () => {
        const { questionId } = deleteConfirmation;
        setDeleteConfirmation(null);

        try {
            const { error: deleteError } = await supabase
                .from('Area_Preguntas')
                .delete()
                .eq('id', questionId);

            if (deleteError) throw deleteError;

            setSuccessMessage('✓ Pregunta eliminada exitosamente');
            setTimeout(() => setSuccessMessage(''), 3000);
            await loadData();
        } catch (err) {
            console.error('Error deleting question:', err);
            setError('Error al eliminar: ' + err.message);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirmation(null);
    };


    const handleToggleActive = async (questionId, currentStatus) => {
        try {
            const { error: updateError } = await supabase
                .from('Area_Preguntas')
                .update({ activa: !currentStatus })
                .eq('id', questionId);

            if (updateError) throw updateError;

            setSuccessMessage(`✓ Pregunta ${!currentStatus ? 'activada' : 'desactivada'}`);
            setTimeout(() => setSuccessMessage(''), 3000);
            await loadData();
        } catch (err) {
            console.error('Error toggling active:', err);
            setError('Error al cambiar estado: ' + err.message);
        }
    };

    // Filtrar preguntas por búsqueda
    const filteredQuestions = questions.filter(q =>
        q.area?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.texto_pregunta?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                gap: '12px',
                color: '#64748b'
            }}>
                <Loader size={24} className="spin" />
                <span>Cargando preguntas...</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h1 style={{
                            fontFamily: 'Outfit',
                            fontSize: '1.75rem',
                            fontWeight: '700',
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            📋 Gestión de Preguntas del Feedback
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                            Administra las preguntas que se muestran en el formulario de feedback por área
                        </p>
                    </div>
                    <button
                        onClick={initializeNewQuestion}
                        disabled={creatingNew || editingId}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: creatingNew || editingId ? '#cbd5e1' : '#3b82f6',
                            color: 'white',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            cursor: creatingNew || editingId ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Plus size={20} />
                        Nueva Pregunta
                    </button>
                </div>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
                <div style={{
                    padding: '1rem',
                    background: '#dcfce7',
                    color: '#166534',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <Check size={20} />
                    {successMessage}
                </div>
            )}

            {error && (
                <div style={{
                    padding: '1rem',
                    background: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* New Question Form */}
            {creatingNew && (
                <div style={{
                    background: 'white',
                    border: '2px solid #3b82f6',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
                        ➕ Nueva Pregunta
                    </h3>
                    {renderEditForm('new')}
                </div>
            )}

            {/* Search Bar */}
            {!creatingNew && (
                <div style={{
                    marginBottom: '1.5rem',
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center'
                }}>
                    <div style={{
                        flex: 1,
                        position: 'relative'
                    }}>
                        <Search
                            size={20}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#94a3b8'
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Buscar por área o pregunta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem 0.75rem 2.75rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredQuestions.length === 0 && !creatingNew ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem',
                        color: '#94a3b8'
                    }}>
                        {searchTerm ? 'No se encontraron preguntas' : 'No hay preguntas configuradas. Haz clic en "Nueva Pregunta" para crear una.'}
                    </div>
                ) : (
                    filteredQuestions.map((question) => (
                        <div
                            key={question.id}
                            style={{
                                background: 'white',
                                border: `2px solid ${editingId === question.id ? '#3b82f6' : '#e2e8f0'}`,
                                borderRadius: '12px',
                                padding: '1.5rem',
                                transition: 'all 0.2s',
                                opacity: question.activa ? 1 : 0.6
                            }}
                        >
                            {renderQuestionCard(question)}
                        </div>
                    ))
                )}
            </div>

            {/* Preview Modal */}
            {showPreview && previewQuestion && (
                <PreviewModal
                    question={previewQuestion}
                    onClose={() => {
                        setShowPreview(false);
                        setPreviewQuestion(null);
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '2rem',
                        maxWidth: '500px',
                        width: '100%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: '#fee2e2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <AlertCircle size={24} color="#dc2626" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                                Confirmar Eliminación
                            </h2>
                        </div>

                        <p style={{ fontSize: '1rem', color: '#4b5563', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                            ¿Estás seguro de eliminar la pregunta del área <strong>"{deleteConfirmation.areaName}"</strong>?
                        </p>

                        <div style={{
                            padding: '1rem',
                            background: '#fef3c7',
                            borderRadius: '8px',
                            marginBottom: '1.5rem'
                        }}>
                            <p style={{ fontSize: '0.9rem', color: '#92400e', margin: 0 }}>
                                ⚠️ Esta acción no se puede deshacer. La pregunta será eliminada permanentemente.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={cancelDelete}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    background: 'white',
                                    color: '#374151',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#dc2626',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Trash2 size={18} />
                                Eliminar Pregunta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for spin animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );

    function renderQuestionCard(question) {
        if (editingId === question.id) {
            return renderEditForm(question.id);
        }

        return (
            <>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>{question.area?.icono || '📍'}</span>
                        <div>
                            <h3 style={{
                                fontWeight: '600',
                                fontSize: '1.1rem',
                                marginBottom: '0.25rem'
                            }}>
                                {question.area?.nombre || question.area_id}
                            </h3>
                            <span style={{
                                fontSize: '0.8rem',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Pregunta {question.numero_pregunta} • {
                                    question.tipo_respuesta === 'si_no' ? 'Sí/No' :
                                        question.tipo_respuesta === 'multiple' ? 'Múltiple' :
                                            question.tipo_respuesta === 'escala' ? 'Escala' :
                                                question.tipo_respuesta === 'emoji' ? 'Emoji' :
                                                    'Texto'
                                }
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => handleToggleActive(question.id, question.activa)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: question.activa ? '#dcfce7' : '#f1f5f9',
                                color: question.activa ? '#166534' : '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {question.activa ? '✓ Activa' : '○ Inactiva'}
                        </button>
                        <button
                            onClick={() => handlePreview(question)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                color: '#8b5cf6',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            title="Vista Previa"
                        >
                            <Eye size={18} />
                        </button>
                        <button
                            onClick={() => handleDuplicate(question)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                color: '#059669',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            title="Duplicar"
                        >
                            <Copy size={18} />
                        </button>
                        <button
                            onClick={() => handleEdit(question)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            title="Editar"
                        >
                            <Edit2 size={18} />
                        </button>
                        <button
                            onClick={() => handleDelete(question.id, question.area?.nombre)}
                            style={{
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            title="Eliminar"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                    color: '#334155'
                }}>
                    {question.texto_pregunta}
                </div>

                {/* Show options for multiple choice */}
                {question.tipo_respuesta === 'multiple' && question.opciones && question.opciones.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingLeft: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>
                            Opciones:
                        </div>
                        {question.opciones.map((opt, idx) => (
                            <div key={idx} style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.25rem' }}>
                                • {opt.texto} <span style={{ color: '#94a3b8' }}>(valor: {opt.valor})</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Show scale range */}
                {question.tipo_respuesta === 'escala' && question.mapeo_calificacion && (
                    <div style={{ marginTop: '1rem', paddingLeft: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                            Escala: {question.mapeo_calificacion.min} - {question.mapeo_calificacion.max}
                        </div>
                    </div>
                )}
            </>
        );
    }

    function renderEditForm(questionId) {
        return (
            <div style={{ marginTop: '1rem' }}>
                {/* Área */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: '#334155'
                    }}>
                        Área
                    </label>
                    <select
                        value={editForm.area_id}
                        onChange={(e) => setEditForm({ ...editForm, area_id: e.target.value })}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    >
                        {areas.map(area => (
                            <option key={area.id} value={area.id}>
                                {area.icono} {area.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Texto de la Pregunta */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: '#334155'
                    }}>
                        Texto de la Pregunta
                    </label>
                    <textarea
                        value={editForm.texto_pregunta}
                        onChange={(e) => setEditForm({ ...editForm, texto_pregunta: e.target.value })}
                        rows={3}
                        placeholder="Escribe la pregunta que se mostrará en el formulario..."
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Tipo de Respuesta */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: '#334155'
                    }}>
                        Tipo de Respuesta
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {[
                            { value: 'si_no', label: 'Sí/No' },
                            { value: 'multiple', label: 'Múltiple' },
                            { value: 'escala', label: 'Escala' },
                            { value: 'emoji', label: 'Emoji' },
                            { value: 'texto', label: 'Texto' }
                        ].map(tipo => (
                            <label key={tipo.value} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="radio"
                                    name="tipo_respuesta"
                                    value={tipo.value}
                                    checked={editForm.tipo_respuesta === tipo.value}
                                    onChange={(e) => handleTypeChange(e.target.value)}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.9rem' }}>{tipo.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Configuración de Escala */}
                {editForm.tipo_respuesta === 'escala' && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                        <label style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: '#334155',
                            marginBottom: '0.75rem',
                            display: 'block'
                        }}>
                            Configuración de Escala
                        </label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                                    Valor Mínimo
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.mapeo_calificacion?.min || 1}
                                    onChange={(e) => handleScaleChange('min', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                                    Valor Máximo
                                </label>
                                <input
                                    type="number"
                                    min="2"
                                    max="10"
                                    value={editForm.mapeo_calificacion?.max || 5}
                                    onChange={(e) => handleScaleChange('max', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                            💡 Las respuestas se normalizarán automáticamente a escala 1-5 para el dashboard
                        </div>
                    </div>
                )}

                {/* Opciones para tipo Múltiple */}
                {editForm.tipo_respuesta === 'multiple' && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label style={{
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: '#334155'
                            }}>
                                Opciones de Respuesta
                            </label>
                            <button
                                onClick={handleAddOption}
                                type="button"
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid #3b82f6',
                                    background: 'white',
                                    color: '#3b82f6',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <PlusCircle size={16} />
                                Agregar Opción
                            </button>
                        </div>
                        {editForm.opciones && editForm.opciones.map((option, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                gap: '0.75rem',
                                marginBottom: '0.75rem',
                                alignItems: 'center'
                            }}>
                                <input
                                    type="text"
                                    value={option.texto}
                                    onChange={(e) => handleOptionChange(index, 'texto', e.target.value)}
                                    placeholder="Texto de la opción"
                                    style={{
                                        flex: 1,
                                        padding: '0.6rem',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        outline: 'none'
                                    }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Valor:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={option.valor}
                                        onChange={(e) => handleOptionChange(index, 'valor', e.target.value)}
                                        style={{
                                            width: '60px',
                                            padding: '0.6rem',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={() => handleRemoveOption(index)}
                                    type="button"
                                    style={{
                                        padding: '0.6rem',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        background: 'white',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Eliminar opción"
                                >
                                    <MinusCircle size={18} />
                                </button>
                            </div>
                        ))}
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                            💡 El valor determina la calificación (1-5) que se asignará a cada respuesta
                        </div>
                    </div>
                )}

                {/* Checkboxes */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="checkbox"
                            checked={editForm.activa}
                            onChange={(e) => setEditForm({ ...editForm, activa: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>Pregunta activa</span>
                    </label>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            color: '#64748b',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: saving ? 0.5 : 1
                        }}
                    >
                        <X size={16} />
                        Cancelar
                    </button>
                    <button
                        onClick={() => handleSave(questionId)}
                        disabled={saving}
                        style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#3b82f6',
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? (
                            <>
                                <Loader size={16} className="spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Guardar
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }
};

// Preview Modal Component
const PreviewModal = ({ question, onClose }) => {
    const [previewAnswer, setPreviewAnswer] = useState('');

    const renderPreviewInput = () => {
        switch (question.tipo_respuesta) {
            case 'si_no':
                return (
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        {['Sí', 'No'].map(option => (
                            <button
                                key={option}
                                onClick={() => setPreviewAnswer(option)}
                                style={{
                                    padding: '0.75rem 2rem',
                                    borderRadius: '8px',
                                    border: `2px solid ${previewAnswer === option ? '#3b82f6' : '#cbd5e1'}`,
                                    background: previewAnswer === option ? '#dbeafe' : 'white',
                                    color: previewAnswer === option ? '#1e40af' : '#64748b',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                );

            case 'multiple':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {question.opciones?.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => setPreviewAnswer(opt.texto)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: `2px solid ${previewAnswer === opt.texto ? '#3b82f6' : '#cbd5e1'}`,
                                    background: previewAnswer === opt.texto ? '#dbeafe' : 'white',
                                    color: previewAnswer === opt.texto ? '#1e40af' : '#334155',
                                    fontSize: '0.95rem',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'
                                }}
                            >
                                {opt.texto}
                            </button>
                        ))}
                    </div>
                );

            case 'escala':
                const { min, max } = question.mapeo_calificacion || { min: 1, max: 5 };
                return (
                    <div>
                        <input
                            type="range"
                            min={min}
                            max={max}
                            value={previewAnswer || min}
                            onChange={(e) => setPreviewAnswer(e.target.value)}
                            style={{ width: '100%', marginBottom: '0.5rem' }}
                        />
                        <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '600', color: '#3b82f6' }}>
                            {previewAnswer || min}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b' }}>
                            <span>{min}</span>
                            <span>{max}</span>
                        </div>
                    </div>
                );

            case 'emoji':
                const emojis = ['😠', '😕', '😐', '🙂', '😍'];
                return (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {emojis.map((emoji, idx) => (
                            <button
                                key={idx}
                                onClick={() => setPreviewAnswer(emoji)}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: `2px solid ${previewAnswer === emoji ? '#3b82f6' : '#cbd5e1'}`,
                                    background: previewAnswer === emoji ? '#dbeafe' : 'white',
                                    fontSize: '2rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                );

            case 'texto':
                return (
                    <textarea
                        value={previewAnswer}
                        onChange={(e) => setPreviewAnswer(e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            outline: 'none'
                        }}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                        👁️ Vista Previa
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        {question.area?.icono} {question.area?.nombre}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: '#334155' }}>
                        {question.texto_pregunta}
                    </div>
                </div>

                {renderPreviewInput()}

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                        💡 Esta es una vista previa. Los cambios no se guardarán.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionManager;
