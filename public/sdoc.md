---
file: sdoc.md
title: Miyagi Reports
tags:
  - report-hub
  - pmo
---

# Miyagi Reports

Este hub renderiza reportes operativos PMO producidos por las rutinas de Miyagi Sanchez. Es la superficie de revision para paquetes de reporte antes y despues de enviarlos por Telegram.

Usalo para:

- Decks tipo historia del standup diario.
- Recapitulaciones PMO semanales.
- Paquetes operativos mensuales.
- Fuentes de reporte que mezclan prosa, graficas, diagramas, slides y celdas.

## Como funcionan los enlaces

La mayoria de los paquetes viajan como enlaces `/docs#md=...`. El contenido del reporte vive en el fragmento de URL, que los navegadores no envian al servidor al cargar la pagina. El servidor entrega los assets del visor; el navegador renderiza el paquete.

Cuando se genera un enlace corto, el servidor guarda ciphertext cifrado. La llave de descifrado se queda en la URL que recibe quien revisa. Usa enlaces cortos para entrega por Telegram y revision movil, no como archivo de largo plazo.

## Checklist del paquete

- El titulo nombra la rutina y la ventana de reporte.
- El resumen ejecutivo cabe en una pantalla de celular.
- Los enlaces son suficientemente cortos para previews de Telegram.
- Los slides usan formato horizontal, amigable para stories.
- Cada bloque de celdas trae los valores que la persona revisora necesita inspeccionar.
- El paquete dice que necesita atencion, que cambio y que sigue.

## Construido sobre SmallDocs

Miyagi Reports es nuestro fork con marca de SmallDocs. El renderer conserva la mecanica de SmallDocs: entrada Markdown, render del lado del navegador, exportacion a PDF o PowerPoint para slides, y enlaces cortos cifrados opcionales.

Abre `/trust` para verificar los assets servidos contra el manifiesto publicado. Abre `/legal` para licencia y terminos.
