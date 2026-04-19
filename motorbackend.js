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
    if (dotCount > 1) str = str.replace(/\./g, '');
  }

  str = str.replace(/[^\d.-]/g, '');
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}

function parseDataUniversal(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value !== 'string') return null;

  const txt = value.trim();
  if (!txt || txt === "-" || txt === "N/A" || txt === "OK" || txt === "?") return null;

  let m = txt.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const ano = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    return new Date(ano, Number(m[2]) - 1, Number(m[1]), 0, 0, 0);
  }

  m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
  }

  const d = new Date(txt);
  if (!Number.isNaN(d.getTime())) {
    d.setHours(12, 0, 0, 0);
    return d;
  }

  return null;
}

function pickFirstFilled(atual, novo) {
  const atualVal = atual === 0 ? 0 : String(atual || '').trim();
  const novoVal = novo === 0 ? 0 : String(novo || '').trim();
  return atualVal !== '' ? atual : (novoVal !== '' ? novo : atual);
}

function pickEarlierDate(atual, novo) {
  const atualDt = parseDataUniversal(atual);
  const novoDt = parseDataUniversal(novo);

  if (!atualDt && novoDt) return novo;
  if (atualDt && !novoDt) return atual;
  if (!atualDt && !novoDt) return pickFirstFilled(atual, novo);

  return novoDt < atualDt ? novo : atual;
}

function pickLaterDate(atual, novo) {
  const atualDt = parseDataUniversal(atual);
  const novoDt = parseDataUniversal(novo);

  if (!atualDt && novoDt) return novo;
  if (atualDt && !novoDt) return atual;
  if (!atualDt && !novoDt) return pickFirstFilled(atual, novo);

  return novoDt > atualDt ? novo : atual;
}

function explodeJoinedText(value) {
  const txt = String(value || '').trim();
  if (!txt) return [];
  return txt.split(' / ').map(part => String(part || '').trim()).filter(Boolean);
}

function joinUniqueText(...values) {
  const vistos = new Set();
  const saida = [];

  values.forEach(value => {
    const partes = Array.isArray(value) ? value : explodeJoinedText(value);
    partes.forEach(parte => {
      const texto = String(parte || '').trim();
      if (!texto) return;

      const chave = texto.toLocaleLowerCase('pt-BR');
      if (vistos.has(chave)) return;

      vistos.add(chave);
      saida.push(texto);
    });
  });

  return saida.join(' / ');
}

function pushUniqueText(lista, value) {
  const texto = String(value || '').trim();
  if (!texto) return;
  if (!lista.some(item => item.toLocaleLowerCase('pt-BR') === texto.toLocaleLowerCase('pt-BR'))) {
    lista.push(texto);
  }
}

function montarObservacoesConsolidadas(meta) {
  const partes = [];

  if (meta.itens) partes.push(`Itens ERP: ${meta.itens}`);
  if (meta.nfs) partes.push(`NF(s): ${meta.nfs}`);
  if (meta.observacoesExtras.length) partes.push(`Obs. ERP: ${meta.observacoesExtras.join(' | ')}`);

  return partes.join(' | ');
}

function extrairObra2026(erp) {
  const numObra = String(erp?.obra || '').trim();
  if (!numObra) return '';
  const match = numObra.match(/26[.,-]?\d{3,}/);
  return match ? match[0] : '';
}

function calcularStatusProposta(erp) {
  let statusProposta = "ENVIADAS";
  const etapaUp = String(erp?.etapa || '').toUpperCase();

  if (erp?.data_frustrada) {
    statusProposta = "FRUSTRADAS";
  } else if (etapaUp.includes('CONCLU') || erp?.data_faturam || erp?.data_faturamento) {
    statusProposta = "CONCLUIDAS";
  } else if (etapaUp.includes('ENTREGUE')) {
    statusProposta = "ENTREGUES";
  } else if (erp?.data_firmada) {
    statusProposta = "FIRMADAS";
  }

  return statusProposta;
}

function getStatusWeight(status) {
  const mapa = {
    ENVIADAS: 1,
    FIRMADAS: 2,
    ENTREGUES: 3,
    CONCLUIDAS: 4,
    FRUSTRADAS: 5
  };
  return mapa[String(status || "").trim()] || 0;
}

function atualizarStatusMaisForte(atual, novo) {
  return getStatusWeight(novo) >= getStatusWeight(atual) ? novo : atual;
}

const motorBackend = {

  sincronizarEFetch: async function(anoFiltro = '26') {
    try {
      // Compatibilidade preservada com o frontend.
      // Nesta etapa da evolução, a leitura permanece isolada exclusivamente para 2026.
      const anoEfetivo = String(anoFiltro || '26') === '26' ? '26' : '26';

      // 1. Conecta no servidor da empresa usando o Túnel Cloudflare (Seguro, HTTPS e Público)
      const response = await fetch('https://agrees-providence-promoted-shortly.trycloudflare.com/api/carteira');

      if (!response.ok) {
        throw new Error('Erro ao conectar no servidor. Verifique se o túnel e o motor estão rodando.');
      }

      const erpData = await response.json();

      // 2. Prepara o cabeçalho que o script.js espera ler
      const resultado = [
        ["DATA", "OBRA", "CLIENTE", "VALOR", "DIAS PRAZO", ...ITENS_ORDEM, "OBSERVAÇÕES", "DETALHES_JSON", "CPMV", "ITEM", "CATEGORIA"]
      ];

      // Dicionário (memória) para evitar duplicação visual de obras
      const obrasProcessadas = {};

      // 3. Varre os dados do JSON e traduz para a matriz do painel
      if (Array.isArray(erpData) && erpData.length > 0) {
        erpData.forEach(erp => {
          const obra2026 = extrairObra2026(erp);
          if (!obra2026 || !obra2026.startsWith(anoEfetivo)) return;

          const valorERP = erp.p_total !== null ? parseMoneyFlexible(erp.p_total) : 0;
          const statusProposta = calcularStatusProposta(erp);
          const itemAtual = String(erp.item || '').trim();
          const categoriaAtual = String(erp.categoria || '').trim();
          const nfAtual = String(erp.nf || '').trim();
          const observacaoAtual = String(erp.observacoes || erp.obs || '').trim();

          if (!obrasProcessadas[obra2026]) {
            const linhaInicial = [
              erp.data_firmada || "", // 0: DATA FIRMADA
              obra2026, // 1: OBRA LIMPA
              erp.cliente || "", // 2: CLIENTE
              valorERP || 0, // 3: VALOR
              erp.praz || erp.pz || "", // 4: DIAS_PRAZO

              // 5 a 16: Itens de controle em branco
              "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A",

              "", // 17: OBSERVAÇÕES
              "{}", // 18: DETALHES JSON
              erp.cpmv || 0, // 19: CPMV
              itemAtual || "", // 20: ITEM
              categoriaAtual || "", // 21: CATEGORIA

              // 22 a 32: INFORMAÇÕES EXTRAS
              statusProposta, // 22: STATUS GERAL DA PROPOSTA
              erp.data_abertura || "", // 23: ABERTURA
              erp.segmento || "", // 24: SEGMENTO
              erp.vendedor || erp.responsavel || "", // 25: RESPONSAVEL
              erp.complexidade || "", // 26: COMPLEXIDADE
              erp.uf || "", // 27: UF
              erp.etapa || "", // 28: ETAPA
              nfAtual || "", // 29: NF
              erp.data_frustrada || "", // 30: FRUSTRADA
              erp.data_enviada || "", // 31: ENVIADA
              erp.data_faturam || erp.data_faturamento || "" // 32: FATURAMENTO
            ];

            obrasProcessadas[obra2026] = {
              linha: linhaInicial,
              observacoesExtras: []
            };
          } else {
            const linhaExistente = obrasProcessadas[obra2026].linha;

            linhaExistente[3] = parseMoneyFlexible(linhaExistente[3]) + valorERP;
            linhaExistente[0] = pickEarlierDate(linhaExistente[0], erp.data_firmada || "");
            linhaExistente[2] = pickFirstFilled(linhaExistente[2], erp.cliente || "");
            linhaExistente[4] = pickFirstFilled(linhaExistente[4], erp.praz || erp.pz || "");
            linhaExistente[19] = pickFirstFilled(linhaExistente[19], erp.cpmv || 0);
            linhaExistente[22] = atualizarStatusMaisForte(linhaExistente[22], statusProposta);
            linhaExistente[23] = pickEarlierDate(linhaExistente[23], erp.data_abertura || "");
            linhaExistente[24] = pickFirstFilled(linhaExistente[24], erp.segmento || "");
            linhaExistente[25] = pickFirstFilled(linhaExistente[25], erp.vendedor || erp.responsavel || "");
            linhaExistente[26] = pickFirstFilled(linhaExistente[26], erp.complexidade || "");
            linhaExistente[27] = pickFirstFilled(linhaExistente[27], erp.uf || "");
            linhaExistente[28] = pickFirstFilled(linhaExistente[28], erp.etapa || "");
            linhaExistente[30] = pickLaterDate(linhaExistente[30], erp.data_frustrada || "");
            linhaExistente[31] = pickEarlierDate(linhaExistente[31], erp.data_enviada || "");
            linhaExistente[32] = pickLaterDate(linhaExistente[32], erp.data_faturam || erp.data_faturamento || "");
          }

          const agregada = obrasProcessadas[obra2026];
          agregada.linha[20] = joinUniqueText(agregada.linha[20], itemAtual ? [itemAtual] : []);
          agregada.linha[21] = joinUniqueText(agregada.linha[21], categoriaAtual ? [categoriaAtual] : []);
          agregada.linha[29] = joinUniqueText(agregada.linha[29], nfAtual ? [nfAtual] : []);

          if (observacaoAtual) {
            pushUniqueText(agregada.observacoesExtras, observacaoAtual);
          }

          agregada.linha[17] = montarObservacoesConsolidadas({
            itens: agregada.linha[20],
            nfs: agregada.linha[29],
            observacoesExtras: agregada.observacoesExtras
          });
        });

        // Ordenação crescente e definitiva
        const listaObras = Object.values(obrasProcessadas).map(item => item.linha);
        listaObras.sort((a, b) => a[1].localeCompare(b[1], 'pt-BR', { numeric: true }));
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
