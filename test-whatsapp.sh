#!/bin/bash
curl -s \
  -X POST \
  "https://qdbosheknbgyqhtoxmfv.supabase.co/functions/v1/send-whatsapp-alert" \
  -H "Content-Type: application/json" \
  -d '{"score":1,"comment":"Prueba desde script","whatsapp_number":"5215550733331","qr_label":"Caja principal"}'
