// ==========================================
// motorbackend.js
// CONEXÃO LOCAL (NODE.JS) - SUBSTITUINDO O SUPABASE
// ARQUITETURA: ERP-FIRST com OVERRIDE MANUAL e EXIBIÇÃO TOTAL
// ==========================================

const ITENS_ORDEM = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

function getSafeId(str) { 
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
}

const motorBackend = {

  sincronizarEFetch: async function() {
    try {
      // 1. Conecta no servidor da empresa usando o Túnel Cloudflare (Seguro, HTTPS e Público)
      const response = await fetch('https://thumbzilla-modern-refrigerator-simon.trycloudflare.com/api/carteira');
      
      if (!response.ok) {
        throw new Error('Erro ao conectar no servidor. Verifique se o túnel e o motor estão rodando.');
      }
      
      const erpData = await response.json();

      // 2. Prepara o cabeçalho que o script.js espera ler
      const resultado = [
        ["DATA", "OBRA", "CLIENTE", "VALOR", "DIAS PRAZO", ...ITENS_ORDEM, "OBSERVAÇÕES", "DETALHES_JSON", "CPMV", "ITEM", "CATEGORIA"]
      ];

      // Dicionário (memória) para evitar duplicação de obras
      const obrasProcessadas = {};

      // 3. Varre os dados do JSON e traduz para a matriz do painel
      if (erpData && erpData.length > 0) {
        erpData.forEach(erp => {
          const numObra = String(erp.obra || '').trim();
          if(!numObra) return;

          // --- FILTRO: APENAS OBRAS DE 2026 (IGNORA 2023 E OUTROS) ---
          const matchNum = numObra.match(/26[.,-]?\d{3,}/);
          if (!matchNum) return; 

          const numObraLimpo = matchNum[0]; 

          // --- PREVENÇÃO DE DUPLICATAS (AGRUPAMENTO) ---
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

          // Puxando o valor total correto da sua view
          const valorERP = erp.p_total !== null ? erp.p_total : "0";

          // Lógica automática para definir o STATUS DA PROPOSTA
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

          // Cria a linha nova da Obra
          const novaLinha = [
            erp.data_firmada || "", // 0: DATA FIRMADA
            numObraLimpo, // 1: OBRA LIMPA
            erp.cliente || "", // 2: CLIENTE
            valorERP || "", // 3: VALOR
            erp.praz || erp.pz || "", // 4: DIAS_PRAZO
            
            // 5 a 16: Itens de controle em branco
            "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A",
            
            "", // 17: OBSERVAÇÕES
            "{}", // 18: DETALHES JSON
            erp.cpmv || 0, // 19: CPMV
            erp.item || "", // 20: ITEM (Aqui entra o 1º item)
            erp.categoria || "", // 21: CATEGORIA
            
            // 22 a 32: INFORMAÇÕES EXTRAS
            statusProposta, // 22: STATUS GERAL DA PROPOSTA
            erp.data_abertura || "", // 23: ABERTURA
            erp.segmento || "", // 24: SEGMENTO
            erp.vendedor || erp.responsavel || "", // 25: RESPONSAVEL
            erp.complexidade || "", // 26: COMPLEXIDADE
            erp.uf || "", // 27: UF
            erp.etapa || "", // 28: ETAPA
            erp.nf || "", // 29: NF
            erp.data_frustrada || "", // 30: FRUSTRADA
            erp.data_enviada || "", // 31: ENVIADA
            erp.data_faturam || erp.data_faturamento || "" // 32: FATURAMENTO
          ];

          // Guarda na memória
          obrasProcessadas[numObraLimpo] = novaLinha;
        });

        // Ordenação crescente e definitiva
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
  
  salvarProjeto: async function(obj) {
    console.log("Simulação local de salvamento:", obj);
    return "✅ (Modo Local) Dados processados na sessão!";
  },
  
  getResumoGeralObra: async function(numObra) {
    return { encontrado: false }; 
  },
  
  getDadosGeralSimplificado: async function(numObra) {
    return null; 
  },
  
  excluirObra: async function(numObra) {
    return "🗑️ (Modo Local) Simulação de exclusão concluída.";
  }
};

window.motorBackend = motorBackend;
