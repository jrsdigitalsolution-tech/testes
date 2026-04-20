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

function parseMoneyFlexible(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let str = String(value).trim();
  if (!str) return 0;

  str = str.replace(/\s/g, '').replace(/[R$r$\u00A0]/g, '');

  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  str = str.replace(/[^\d.-]/g, '');
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}

function addUnique(setRef, value) {
  const txt = String(value || '').trim();
  if (txt) setRef.add(txt);
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === 0) return value;
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return "";
}

function buildObservacoesConsolidadas(bloco) {
  const partes = [];

  if (bloco.observacoes.size > 0) {
    partes.push(Array.from(bloco.observacoes).join(" | "));
  }

  if (bloco.nfs.size > 0) {
    partes.push("NF(s): " + Array.from(bloco.nfs).join(" / "));
  }

  if (bloco.itens.size > 0) {
    partes.push("Itens ERP: " + Array.from(bloco.itens).join(" / "));
  }

  return partes.join(" • ");
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

      // Dicionário (memória) para consolidar obras
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

          if (!obrasProcessadas[numObraLimpo]) {
            obrasProcessadas[numObraLimpo] = {
              linha: [
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
                erp.item || "", // 20: ITEM
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
              ],
              valorTotal: parseMoneyFlexible(valorERP),
              itens: new Set(),
              categorias: new Set(),
              nfs: new Set(),
              observacoes: new Set()
            };
          } else {
            const blocoExistente = obrasProcessadas[numObraLimpo];
            blocoExistente.valorTotal += parseMoneyFlexible(valorERP);

            // Só preenche campos-base se estiverem vazios, preservando o comportamento atual ao máximo
            blocoExistente.linha[0] = pickFirstNonEmpty(blocoExistente.linha[0], erp.data_firmada);
            blocoExistente.linha[2] = pickFirstNonEmpty(blocoExistente.linha[2], erp.cliente);
            blocoExistente.linha[4] = pickFirstNonEmpty(blocoExistente.linha[4], erp.praz, erp.pz);
            blocoExistente.linha[19] = pickFirstNonEmpty(blocoExistente.linha[19], erp.cpmv || 0);
            blocoExistente.linha[22] = pickFirstNonEmpty(blocoExistente.linha[22], statusProposta);
            blocoExistente.linha[23] = pickFirstNonEmpty(blocoExistente.linha[23], erp.data_abertura);
            blocoExistente.linha[24] = pickFirstNonEmpty(blocoExistente.linha[24], erp.segmento);
            blocoExistente.linha[25] = pickFirstNonEmpty(blocoExistente.linha[25], erp.vendedor, erp.responsavel);
            blocoExistente.linha[26] = pickFirstNonEmpty(blocoExistente.linha[26], erp.complexidade);
            blocoExistente.linha[27] = pickFirstNonEmpty(blocoExistente.linha[27], erp.uf);
            blocoExistente.linha[28] = pickFirstNonEmpty(blocoExistente.linha[28], erp.etapa);
            blocoExistente.linha[30] = pickFirstNonEmpty(blocoExistente.linha[30], erp.data_frustrada);
            blocoExistente.linha[31] = pickFirstNonEmpty(blocoExistente.linha[31], erp.data_enviada);
            blocoExistente.linha[32] = pickFirstNonEmpty(blocoExistente.linha[32], erp.data_faturam, erp.data_faturamento);
          }

          const bloco = obrasProcessadas[numObraLimpo];

          addUnique(bloco.itens, erp.item);
          addUnique(bloco.categorias, erp.categoria);
          addUnique(bloco.nfs, erp.nf);
          addUnique(bloco.observacoes, erp.observacoes);
          addUnique(bloco.observacoes, erp.observacao);
          addUnique(bloco.observacoes, erp.obs);
          addUnique(bloco.observacoes, erp.analise);
        });

        // Consolidação final antes do retorno
        const listaObras = Object.values(obrasProcessadas).map(bloco => {
          bloco.linha[3] = bloco.valorTotal;
          bloco.linha[17] = buildObservacoesConsolidadas(bloco);
          bloco.linha[20] = Array.from(bloco.itens).join(" / ");
          bloco.linha[21] = Array.from(bloco.categorias).join(" / ");
          bloco.linha[29] = Array.from(bloco.nfs).join(" / ");
          return bloco.linha;
        });

        // Ordenação crescente e definitiva
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
