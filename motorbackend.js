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

function parseValorERP(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let str = String(value).trim();
  if (!str) return 0;

  str = str.replace(/\s/g, '').replace(/[R$r$\u00A0]/g, '');

  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) str = str.replace(/\./g, '');
  }

  str = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

function addValorERP(baseValue, valorSomado) {
  const baseNum = parseValorERP(baseValue);
  return String(baseNum + valorSomado);
}

function adicionarUnico(setRef, value) {
  const txt = String(value || '').trim();
  if (txt) setRef.add(txt);
}

function montarObservacoesConsolidadas(observacoesERP, itensERP, nfsERP) {
  const partes = [];

  if (itensERP.size > 0) {
    partes.push(`ITENS ERP: ${Array.from(itensERP).join(' / ')}`);
  }

  if (nfsERP.size > 0) {
    partes.push(`NF(S): ${Array.from(nfsERP).join(' / ')}`);
  }

  if (observacoesERP.size > 0) {
    partes.push(`OBS ERP: ${Array.from(observacoesERP).join(' | ')}`);
  }

  return partes.join(' • ');
}

const motorBackend = {

  sincronizarEFetch: async function() {
    try {
      // 1. Conecta no servidor da empresa usando o Túnel Cloudflare (Seguro, HTTPS e Público)
      const response = await fetch('https://bathrooms-estate-implications-dancing.trycloudflare.com/api/carteira');

      if (!response.ok) {
        throw new Error('Erro ao conectar no servidor. Verifique se o túnel e o motor estão rodando.');
      }

      const erpData = await response.json();

      // 2. Prepara o cabeçalho que o script.js espera ler
      const resultado = [
        ["DATA", "OBRA", "CLIENTE", "VALOR", "DIAS PRAZO", ...ITENS_ORDEM, "OBSERVAÇÕES", "DETALHES_JSON", "CPMV", "ITEM", "CATEGORIA"]
      ];

      // Dicionário (memória) para consolidação de obras
      const obrasProcessadas = {};

      // 3. Varre os dados do JSON e traduz para a matriz do painel
      if (erpData && erpData.length > 0) {
        erpData.forEach(erp => {
          const numObra = String(erp.obra || '').trim();
          if (!numObra) return;

          // --- FILTRO: APENAS OBRAS DE 2026 (IGNORA 2023 E OUTROS) ---
          const matchNum = numObra.match(/26[.,-]?\d{3,}/);
          if (!matchNum) return; 

          const numObraLimpo = matchNum[0];
          const itemAtual = String(erp.item || '').trim();
          const catAtual = String(erp.categoria || '').trim();
          const nfAtual = String(erp.nf || '').trim();
          const obsAtual = String(erp.observacoes || erp.obs || erp.observacao || '').trim();
          const valorERP = parseValorERP(erp.p_total);

          // --- CONSOLIDAÇÃO DE DUPLICATAS (AGRUPAMENTO) ---
          if (obrasProcessadas[numObraLimpo]) {
            const obraAgrupada = obrasProcessadas[numObraLimpo];
            const linhaExistente = obraAgrupada.linha;

            linhaExistente[3] = addValorERP(linhaExistente[3], valorERP);

            adicionarUnico(obraAgrupada.itensSet, itemAtual);
            adicionarUnico(obraAgrupada.categoriasSet, catAtual);
            adicionarUnico(obraAgrupada.nfsSet, nfAtual);
            adicionarUnico(obraAgrupada.observacoesSet, obsAtual);

            linhaExistente[17] = montarObservacoesConsolidadas(
              obraAgrupada.observacoesSet,
              obraAgrupada.itensSet,
              obraAgrupada.nfsSet
            );
            linhaExistente[20] = Array.from(obraAgrupada.itensSet).join(' / ');
            linhaExistente[21] = Array.from(obraAgrupada.categoriasSet).join(' / ');
            linhaExistente[29] = Array.from(obraAgrupada.nfsSet).join(' / ');
            return; 
          }

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

          const itensSet = new Set();
          const categoriasSet = new Set();
          const nfsSet = new Set();
          const observacoesSet = new Set();

          adicionarUnico(itensSet, itemAtual);
          adicionarUnico(categoriasSet, catAtual);
          adicionarUnico(nfsSet, nfAtual);
          adicionarUnico(observacoesSet, obsAtual);

          const observacaoConsolidada = montarObservacoesConsolidadas(observacoesSet, itensSet, nfsSet);

          // Cria a linha nova da Obra
          const novaLinha = [
            erp.data_firmada || "", // 0: DATA FIRMADA
            numObraLimpo, // 1: OBRA LIMPA
            erp.cliente || "", // 2: CLIENTE
            String(valorERP), // 3: VALOR
            erp.praz || erp.pz || "", // 4: DIAS_PRAZO

            // 5 a 16: Itens de controle em branco
            "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A",

            observacaoConsolidada, // 17: OBSERVAÇÕES
            "{}", // 18: DETALHES JSON
            erp.cpmv || 0, // 19: CPMV
            Array.from(itensSet).join(' / '), // 20: ITEM
            Array.from(categoriasSet).join(' / '), // 21: CATEGORIA

            // 22 a 32: INFORMAÇÕES EXTRAS
            statusProposta, // 22: STATUS GERAL DA PROPOSTA
            erp.data_abertura || "", // 23: ABERTURA
            erp.segmento || "", // 24: SEGMENTO
            erp.vendedor || erp.responsavel || "", // 25: RESPONSAVEL
            erp.complexidade || "", // 26: COMPLEXIDADE
            erp.uf || "", // 27: UF
            erp.etapa || "", // 28: ETAPA
            Array.from(nfsSet).join(' / '), // 29: NF
            erp.data_frustrada || "", // 30: FRUSTRADA
            erp.data_enviada || "", // 31: ENVIADA
            erp.data_faturam || erp.data_faturamento || "" // 32: FATURAMENTO
          ];

          // Guarda na memória
          obrasProcessadas[numObraLimpo] = {
            linha: novaLinha,
            itensSet,
            categoriasSet,
            nfsSet,
            observacoesSet
          };
        });

        // Ordenação crescente e definitiva
        const listaObras = Object.values(obrasProcessadas).map(reg => reg.linha);
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
