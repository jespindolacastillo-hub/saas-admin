// Utility function to print QR codes
import QRCode from 'qrcode';

export const printQRCodes = async (areas, storeName, getQRUrl) => {
  if (!areas || areas.length === 0) {
    alert('No hay áreas para imprimir');
    return;
  }

  console.log('printQRCodes called with', { areasCount: areas.length, storeName });

  // Fixed layout: Always 4 QR codes per page (2x2 grid)
  const config = {
    cols: 2,
    qrSize: 195,
    fontSize: '1rem',
    qrPerPage: 4
  };

  // Generate QR codes as data URLs
  const qrPromises = areas.map(async (ta) => {
    const qrUrl = getQRUrl(ta.area_id);
    console.log('Generating QR for:', ta.Areas_Catalogo.nombre, qrUrl);
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: config.qrSize,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      console.log('QR generated successfully for:', ta.Areas_Catalogo.nombre);
      return {
        dataUrl,
        areaName: ta.Areas_Catalogo.nombre
      };
    } catch (error) {
      console.error('Error generating QR for', ta.Areas_Catalogo.nombre, error);
      return null;
    }
  });

  const qrData = (await Promise.all(qrPromises)).filter(qr => qr !== null);
  console.log('Generated', qrData.length, 'QR codes');

  if (qrData.length === 0) {
    alert('No se pudieron generar los códigos QR');
    return;
  }

  // Build HTML - group QR codes into pages (4 per page)
  let pagesHTML = '';

  for (let i = 0; i < qrData.length; i += config.qrPerPage) {
    const pageQRs = qrData.slice(i, i + config.qrPerPage);
    const isLastPage = i + config.qrPerPage >= qrData.length;

    pagesHTML += `
      <div class="qr-page" style="${!isLastPage ? 'page-break-after: always;' : ''}">
        <div class="qr-grid">
    `;

    pageQRs.forEach(qr => {
      pagesHTML += `
        <div class="qr-item">
          <div class="qr-container">
            <div class="cut-marks">
              <div class="cut-mark top-left"></div>
              <div class="cut-mark top-right"></div>
              <div class="cut-mark bottom-left"></div>
              <div class="cut-mark bottom-right"></div>
            </div>
            <img src="${qr.dataUrl}" width="${config.qrSize}" height="${config.qrSize}" alt="QR ${qr.areaName}" style="display: block;" />
          </div>
          <div class="qr-label">${qr.areaName}</div>
          <div class="qr-store">${storeName}</div>
        </div>
      `;
    });

    pagesHTML += `
        </div>
      </div>
    `;
  }


  // Open print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para imprimir');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>QR Codes - ${storeName}</title>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            background: white;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          .qr-page {
            position: relative;
            width: 100vw;
            height: 100vh;
            page-break-after: always;
            break-after: page;
          }
          .qr-grid {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: grid;
            grid-template-columns: repeat(${config.cols}, auto);
            gap: 15mm;
          }
          .qr-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            break-inside: avoid;
          }
          .qr-container {
            background: white;
            padding: 8mm;
            border-radius: 12px;
            border: 2px solid #e2e8f0;
            margin-bottom: 6mm;
            display: inline-block;
            position: relative;
          }
          .qr-container img {
            display: block;
          }
          
          /* Corner cut marks */
          .cut-marks {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
          }
          .cut-mark {
            position: absolute;
            width: 8mm;
            height: 8mm;
          }
          .cut-mark::before,
          .cut-mark::after {
            content: '';
            position: absolute;
            background: #94a3b8;
          }
          .cut-mark::before {
            width: 8mm;
            height: 1px;
          }
          .cut-mark::after {
            width: 1px;
            height: 8mm;
          }
          
          /* Top-left corner */
          .cut-mark.top-left {
            top: -2mm;
            left: -2mm;
          }
          .cut-mark.top-left::before {
            top: 0;
            left: 0;
          }
          .cut-mark.top-left::after {
            top: 0;
            left: 0;
          }
          
          /* Top-right corner */
          .cut-mark.top-right {
            top: -2mm;
            right: -2mm;
          }
          .cut-mark.top-right::before {
            top: 0;
            right: 0;
          }
          .cut-mark.top-right::after {
            top: 0;
            right: 0;
          }
          
          /* Bottom-left corner */
          .cut-mark.bottom-left {
            bottom: -2mm;
            left: -2mm;
          }
          .cut-mark.bottom-left::before {
            bottom: 0;
            left: 0;
          }
          .cut-mark.bottom-left::after {
            bottom: 0;
            left: 0;
          }
          
          /* Bottom-right corner */
          .cut-mark.bottom-right {
            bottom: -2mm;
            right: -2mm;
          }
          .cut-mark.bottom-right::before {
            bottom: 0;
            right: 0;
          }
          .cut-mark.bottom-right::after {
            bottom: 0;
            right: 0;
          }
          
          .qr-label {
            font-size: ${config.fontSize};
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 2mm;
          }
          .qr-store {
            font-size: calc(${config.fontSize} * 0.8);
            color: #64748b;
          }
          @media print {
            html, body {
              width: 100%;
              height: 100%;
            }
            .qr-page {
              width: 100%;
              height: 100vh;
            }
            .qr-grid {
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            }
            .qr-item { break-inside: avoid; }
          }
          @page {
            size: letter;
            margin: 20mm;
          }
        </style>
      </head>
      <body>
        ${pagesHTML}
        <script>
          console.log('Print page loaded with ${qrData.length} QR codes');
          window.onload = function() {
            console.log('Window loaded, triggering print in 500ms');
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

  console.log('Writing HTML to print window');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  console.log('Print window ready');
};
