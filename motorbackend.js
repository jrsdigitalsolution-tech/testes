// ==========================================
// motorbackend.js
// CONEXÃO LOCAL (NODE.JS) - SUBSTITUINDO O SUPABASE
// ==========================================

const ITENS_ORDEM = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

function getSafeId(str) { 
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
}

const motorBackend = {

  // Recebe o ano (ex: '26') do script.js
  sincronizarEFetch: async function(anoFiltro = 'TODOS') {
    try {
      // LINK ORIGINAL DO SEU SERVIDOR RESTAURADO E FUNCIONAL
      const response = await fetch('https://thumbzilla-modern-refrigerator-simon.trycloudflare.com/api/carteira');
      
      if (!response.ok) {
        throw new Error('Erro ao conectar no servidor. Verifique se o túnel e o motor estão rodando.');
      }
      
      const erpData = await response.json();

      const resultado = [
        ["DATA", "OBRA", "CLIENTE", "VALOR", "DIAS PRAZO", ...ITENS_ORDEM, "OBSERVAÇÕES", "DETALHES_JSON", "CPMV", "ITEM", "CATEGORIA"]
      ];

      const obrasProcessadas = {};

      if (erpData && erpData.length > 0) {
        erpData.forEach(erp => {
          const numObra = String(erp.obra || '').trim();
          if(!numObra) return;

          // Lógica do Filtro de Ano
          if (anoFiltro !== 'TODOS') {
             if (!numObra.startsWith(anoFiltro)) return;
          }

          const numObraLimpo = numObra; 

          if (obrasProcessadas[numObraLimpo]) {
            const linhaExistente = obrasProcessadas[numObraLimpo];
            
            const itemAtual = String(erp.item || '').trim();
            if (itemAtual && !linhaExistente[20].includes(itemAtual)) {
              linhaExistente[20] += " / " + itemAtual;
            }

            const catAtual = String(erp.categoria || '').trim();
            if (catAtual && !linhaExistente[21].includes(catAtual)) {
              linhaExistente[21] += " / " + catAtual;
            }
            return; 
          }

          const valorERP = erp.p_total !== null ? erp.p_total : "0";

          let statusProposta = "ENVIADAS";
          const etapaUp = String(erp.etapa || '').toUpperCase();
          
          if (erp.data_frustrada) {
              statusProposta = "FRUSTRADAS";
          } else if (etapaUp.includes('CONCLU') || erp.data_faturam || erp.data_faturamento) {
              statusProposta = "CONCLUIDAS";
          } else if (etapaUp.includes('ENTREGUE')) {
              statusProposta = "ENTREGUES";
          } else if (erp.data_firmada) {
              statusProposta = "FIRMADAS";
          }

          const novaLinha = [
            erp.data_firmada || "", numObraLimpo, erp.cliente || "", valorERP || "", erp.praz || erp.pz || "",
            "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A",
            "", "{}", erp.cpmv || 0, erp.item || "", erp.categoria || "",
            statusProposta, erp.data_abertura || "", erp.segmento || "", erp.vendedor || erp.responsavel || "",
            erp.complexidade || "", erp.uf || "", erp.etapa || "", erp.nf || "", erp.data_frustrada || "", erp.data_enviada || "", erp.data_faturam || erp.data_faturamento || ""
          ];

          obrasProcessadas[numObraLimpo] = novaLinha;
        });

        const listaObras = Object.values(obrasProcessadas);
        listaObras.sort((a, b) => {
          return a[1].localeCompare(b[1], 'pt-BR', { numeric: true });
        });

        listaObras.forEach(linha => resultado.push(linha));
      }

      return resultado;

    } catch (e) {
      console.error("Erro na comunicação local:", e);
      throw e;
    }
  },
  
  salvarProjeto: async function(obj) { return "✅ (Modo Local) Dados processados na sessão!"; },
  getResumoGeralObra: async function(numObra) { return { encontrado: false }; },
  getDadosGeralSimplificado: async function(numObra) { return null; },
  excluirObra: async function(numObra) { return "🗑️ (Modo Local) Simulação de exclusão concluída."; }
};

window.motorBackend = motorBackend;
