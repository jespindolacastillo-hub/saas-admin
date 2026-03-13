/**
 * Utility to generate localized sample data for Demo Mode.
 * Supports: 'en', 'es', 'pt'
 */

export const getSampleData = (lang = 'es') => {
  const stores = [
    { id: 'store-1', nombre: lang === 'es' ? 'Tienda Centro' : lang === 'pt' ? 'Loja Centro' : 'Downtown Store' },
    { id: 'store-2', nombre: lang === 'es' ? 'Tienda Norte' : lang === 'pt' ? 'Loja Norte' : 'North Side Store' },
    { id: 'store-3', nombre: lang === 'es' ? 'Tienda Sur' : lang === 'pt' ? 'Loja Sul' : 'South Side Store' }
  ];

  const areas = [
    { id: 'area-1', nombre: lang === 'es' ? 'Atención al Cliente' : lang === 'pt' ? 'Atendimento ao Cliente' : 'Customer Service' },
    { id: 'area-2', nombre: lang === 'es' ? 'Cajas' : lang === 'pt' ? 'Caixas' : 'Checkout' },
    { id: 'area-3', nombre: lang === 'es' ? 'Piso de Venta' : lang === 'pt' ? 'Salão de Vendas' : 'Sales Floor' },
    { id: 'area-4', nombre: lang === 'es' ? 'Baños' : lang === 'pt' ? 'Banheiros' : 'Restrooms' }
  ];

  const comments = {
    es: [
      "Excelente servicio en el área de cajas.",
      "Los baños estaban un poco sucios hoy.",
      "Muy buena atención, me ayudaron a encontrar todo.",
      "El tiempo de espera fue un poco largo.",
      "Increíble experiencia, volveré pronto.",
      "La tienda está muy bien organizada.",
      "Falta personal en el pasillo de electrónica.",
      "La cajera fue muy amable y eficiente."
    ],
    en: [
      "Great service at the checkout area.",
      "Restrooms were a bit messy today.",
      "Very good service, they helped me find everything.",
      "The waiting time was a bit too long.",
      "Amazing experience, will come back soon.",
      "The store is very well organized.",
      "Need more staff in the electronics aisle.",
      "The cashier was very friendly and efficient."
    ],
    pt: [
      "Ótimo serviço na área do caixa.",
      "Os banheiros estavam um pouco sujos hoje.",
      "Muito bom atendimento, me ajudaram a encontrar tudo.",
      "O tempo de espera foi um pouco longo.",
      "Experiência incrível, voltarei em breve.",
      "A loja está muito bem organizada.",
      "Falta pessoal no corredor de eletrônicos.",
      "O caixa foi muito gentil e eficiente."
    ]
  };

  const sentiments = ['Positivo', 'Neutral', 'Negativo'];
  const origins = ['QR', 'Email'];
  
  // Generate 100 mock records
  const rawData = Array.from({ length: 100 }).map((_, i) => {
    const store = stores[Math.floor(Math.random() * stores.length)];
    const area = areas[Math.floor(Math.random() * areas.length)];
    const langKey = comments[lang] ? lang : 'en';
    const comment = comments[langKey][Math.floor(Math.random() * comments[langKey].length)];
    const sentiment = Math.random() > 0.6 ? sentiments[0] : (Math.random() > 0.5 ? sentiments[1] : sentiments[2]);
    const satisfaccion = sentiment === 'Positivo' ? 5 : (sentiment === 'Neutral' ? 3 : 1);
    
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    return {
      id: `mock-${i}`,
      created_at: date.toISOString(),
      tienda_id: store.id,
      area_id: area.id,
      satisfaccion,
      sentimiento: sentiment,
      comentario: comment,
      canal: origins[Math.floor(Math.random() * origins.length)],
      tenant_id: 'demo-tenant'
    };
  });

  return { rawData, stores, areas };
};
