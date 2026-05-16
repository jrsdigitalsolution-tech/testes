const ITENS = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

  const COLS = Object.freeze({
    DATA: 0, OBRA: 1, CLIENTE: 2, VALOR: 3, DIAS_PRAZO: 4, ITEM_INICIO: 5, ITEM_FIM: 16, OBS: 17, DETALHES_JSON: 18, CPMV: 19, ITEM_GERAL: 20, CATEGORIA_GERAL: 21,
    STATUS_PROPOSTA: 22, DATA_ABERTURA: 23, SEGMENTO: 24, RESPONSAVEL: 25, COMPLEXIDADE: 26, UF: 27, ETAPA: 28, NF: 29, DATA_FRUSTRADA: 30, DATA_ENVIADA: 31, DATA_FATURAMENTO: 32
  });
  
  let currentStatusFilter = 'FIRMADAS'; // Original Intacto
  let currentAnoFilter = '26'; 
  let currentFaturamentoMesInicio = 'TODOS';
  let currentFaturamentoMesFim = 'TODOS';

  const MESES_FATURAMENTO = [
    { valor: 1, label: 'Janeiro' },
    { valor: 2, label: 'Fevereiro' },
    { valor: 3, label: 'Março' },
    { valor: 4, label: 'Abril' },
    { valor: 5, label: 'Maio' },
    { valor: 6, label: 'Junho' },
    { valor: 7, label: 'Julho' },
    { valor: 8, label: 'Agosto' },
    { valor: 9, label: 'Setembro' },
    { valor: 10, label: 'Outubro' },
    { valor: 11, label: 'Novembro' },
    { valor: 12, label: 'Dezembro' }
  ];

  function isStatusEntregue(status) {
    const statusNormalizado = String(status || '').trim().toUpperCase();
    return statusNormalizado === 'ENTREGUE' || statusNormalizado === 'ENTREGUES' || statusNormalizado === 'CONCLUIDAS';
  }

  function isFiltroEntregueAtual() {
    return isStatusEntregue(currentStatusFilter);
  }

  function isFiltroCarteiraAtual() {
    return String(currentStatusFilter || '').trim().toUpperCase() === 'FIRMADAS';
  }

  function statusLinhaCorrespondeFiltro(statusLinha) {
    if (currentStatusFilter === 'TODAS') return true;
    if (isFiltroEntregueAtual()) return isStatusEntregue(statusLinha);
    return String(statusLinha || '').trim().toUpperCase() === String(currentStatusFilter || '').trim().toUpperCase();
  }

  function getStatusDisplay(status) {
    return isStatusEntregue(status) ? 'ENTREGUE' : String(status || '').trim();
  }

  function mudarAno(ano) {
    const anoEfetivo = '26';
    const houveTentativaDeTroca = Boolean(ano) && String(ano) !== anoEfetivo;

    currentAnoFilter = anoEfetivo;
    sincronizarAnoFixoNaInterface();

    if (houveTentativaDeTroca) {
      notify("<i class='bi bi-calendar-event me-2'></i> Nesta etapa, a carteira está isolada exclusivamente para 2026.");
    }

    carregar();
  }

  function getLimiteMesFiltroConcluidas() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    return Math.min(Math.max(mesAtual, 1), 12);
  }

  function normalizarMesFiltroConcluidas(valor) {
    if (valor === null || valor === undefined || valor === '' || valor === 'TODOS') return 'TODOS';
    const num = parseInt(String(valor), 10);
    const limite = getLimiteMesFiltroConcluidas();
    if (!Number.isFinite(num) || num < 1 || num > limite) return 'TODOS';
    return String(num);
  }

  function preencherOpcoesFiltroConcluidas() {
    const selects = [
      document.getElementById('faturamentoMesInicio'),
      document.getElementById('faturamentoMesFim')
    ].filter(Boolean);

    if (!selects.length) return;

    const limite = getLimiteMesFiltroConcluidas();
    const options = ['<option value="TODOS">Todo período</option>']
      .concat(MESES_FATURAMENTO
        .filter(m => m.valor <= limite)
        .map(m => `<option value="${m.valor}">${m.label}</option>`))
      .join('');

    selects.forEach(select => {
      const valorAtual = select.value;
      select.innerHTML = options;
      select.value = normalizarMesFiltroConcluidas(valorAtual);
    });
  }

  function sincronizarFiltroConcluidasNaInterface() {
    const inicioEl = document.getElementById('faturamentoMesInicio');
    const fimEl = document.getElementById('faturamentoMesFim');
    if (inicioEl) inicioEl.value = normalizarMesFiltroConcluidas(currentFaturamentoMesInicio);
    if (fimEl) fimEl.value = normalizarMesFiltroConcluidas(currentFaturamentoMesFim);
  }

  function atualizarVisibilidadeFiltroConcluidas() {
    const row = document.getElementById('filtroConcluidasFaturamento');
    if (!row) return;
    row.classList.toggle('d-none', !isFiltroEntregueAtual());
  }

  function aplicarFiltroConcluidasPorMes(origem) {
    currentFaturamentoMesInicio = normalizarMesFiltroConcluidas(document.getElementById('faturamentoMesInicio')?.value);
    currentFaturamentoMesFim = normalizarMesFiltroConcluidas(document.getElementById('faturamentoMesFim')?.value);

    if (origem === 'inicio' && currentFaturamentoMesInicio !== 'TODOS' && currentFaturamentoMesFim === 'TODOS') {
      currentFaturamentoMesFim = currentFaturamentoMesInicio;
    }

    if (origem === 'fim' && currentFaturamentoMesFim !== 'TODOS' && currentFaturamentoMesInicio === 'TODOS') {
      currentFaturamentoMesInicio = currentFaturamentoMesFim;
    }

    if (currentFaturamentoMesInicio !== 'TODOS' && currentFaturamentoMesFim !== 'TODOS') {
      const inicioNum = parseInt(currentFaturamentoMesInicio, 10);
      const fimNum = parseInt(currentFaturamentoMesFim, 10);
      if (inicioNum > fimNum) {
        const temp = currentFaturamentoMesInicio;
        currentFaturamentoMesInicio = currentFaturamentoMesFim;
        currentFaturamentoMesFim = temp;
      }
    }

    sincronizarFiltroConcluidasNaInterface();
    renderizar(dadosLocais.slice(1));
  }

  function getRangeFiltroConcluidas() {
    const limite = getLimiteMesFiltroConcluidas();
    const inicio = currentFaturamentoMesInicio === 'TODOS' ? 1 : parseInt(currentFaturamentoMesInicio, 10);
    const fim = currentFaturamentoMesFim === 'TODOS' ? limite : parseInt(currentFaturamentoMesFim, 10);

    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null;
    return { inicio, fim };
  }

  function getAnoFiltroAtualCompleto() {
    const anoNum = parseInt(String(currentAnoFilter || '26').replace(/\D/g, ''), 10);
    if (!Number.isFinite(anoNum)) return 2026;
    return anoNum < 100 ? 2000 + anoNum : anoNum;
  }

  function dataPertenceAoAnoFiltroAtual(data) {
    return data instanceof Date && !Number.isNaN(data.getTime()) && data.getFullYear() === getAnoFiltroAtualCompleto();
  }

  function getDatasFaturamentoLinhaEntregue(row) {
    const datas = [];
    const detalhes = safeJsonParse(row && row[COLS.DETALHES_JSON], {});

    function addData(value) {
      const dt = parseDataUniversal(String(value || "").trim());
      if (dt) datas.push(dt);
    }

    addData(row && row[COLS.DATA_FATURAMENTO]);

    if (detalhes.meta_pedido_operacional) {
      addData(detalhes.meta_pedido_operacional.data_faturamento);
      addData(detalhes.meta_pedido_operacional.data_faturamento_original);
    }

    const pedidosLinha = Array.isArray(detalhes.meta_pedidos_operacionais_linha)
      ? detalhes.meta_pedidos_operacionais_linha
      : [];
    pedidosLinha.forEach(pedido => {
      addData(pedido && pedido.data_faturamento);
      addData(pedido && pedido.data_faturamento_original);
    });

    const docs = Array.isArray(detalhes.meta_concluidas_nf) ? detalhes.meta_concluidas_nf : [];
    docs.forEach(doc => {
      addData(doc && (doc.data_faturamento_original || doc.data_faturamento));
    });

    return datas;
  }

  function linhaConcluidaDentroDoPeriodo(row) {
    if (!isFiltroEntregueAtual()) return true;

    const semFiltro = currentFaturamentoMesInicio === 'TODOS' && currentFaturamentoMesFim === 'TODOS';
    if (semFiltro) return true;

    const range = getRangeFiltroConcluidas();
    if (!range) return true;

    const datasFaturamento = getDatasFaturamentoLinhaEntregue(row);
    if (!datasFaturamento.length) return false;

    return datasFaturamento.some(dataFat => {
      const mesLinha = dataFat.getMonth() + 1;
      return mesLinha >= range.inicio && mesLinha <= range.fim;
    });
  }

  function obterMetaConcluidasNF(row) {
    const detalhes = safeJsonParse(row[COLS.DETALHES_JSON], {});
    const lista = Array.isArray(detalhes.meta_concluidas_nf) ? detalhes.meta_concluidas_nf : [];
    const docs = [];
    const chaves = new Set();

    lista.forEach(doc => {
      const dataOriginal = String((doc && (doc.data_faturamento_original || doc.data_faturamento)) || '').trim();
      const data = parseDataUniversal(dataOriginal);
      const valor = parseMoneyFlexible(doc && doc.valor);
      const nf = String((doc && doc.nf) || '').trim();

      if (!data || valor <= 0) return;
      if (!dataPertenceAoAnoFiltroAtual(data)) return;

      const ano = String(data.getFullYear());
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const chaveDoc = `${nf}|${ano}-${mes}|${valor}`;

      if (chaves.has(chaveDoc)) return;
      chaves.add(chaveDoc);

      docs.push({
        nf,
        valor,
        item: String((doc && doc.item) || '').trim(),
        categoria: String((doc && doc.categoria) || '').trim(),
        numeroPedido: String((doc && (doc.numero_pedido || doc.numeroPedido)) || '').trim(),
        numerosPedido: Array.isArray(doc && doc.numeros_pedido) ? doc.numeros_pedido.map(p => String(p || '').trim()).filter(Boolean) : [],
        dataFaturamentoOriginal: dataOriginal,
        dataFaturamentoTimestamp: data.getTime(),
        mesReferencia: `${ano}-${mes}`
      });
    });

    return docs;
  }

  function obterMetaConcluidasPorMes(row) {
    const detalhes = safeJsonParse(row[COLS.DETALHES_JSON], {});
    const lista = Array.isArray(detalhes.meta_concluidas_por_mes) ? detalhes.meta_concluidas_por_mes : [];

    return lista.map(grupo => {
      const dataOriginal = String((grupo && (grupo.data_faturamento_original || grupo.data_faturamento)) || '').trim();
      const data = parseDataUniversal(dataOriginal);
      const detalhesNFs = Array.isArray(grupo && grupo.detalhes_nfs) ? grupo.detalhes_nfs : [];

      return {
        mesReferencia: String((grupo && grupo.mes_referencia) || '').trim(),
        valorTotal: parseMoneyFlexible(grupo && grupo.valor_total),
        item: String((grupo && grupo.item) || '').trim(),
        categoria: String((grupo && grupo.categoria) || '').trim(),
        nf: String((grupo && grupo.nf) || '').trim(),
        dataFaturamentoOriginal: dataOriginal,
        dataFaturamentoTimestamp: data ? data.getTime() : 0,
        detalhesDocs: detalhesNFs.map(doc => ({
          nf: String((doc && doc.nf) || '').trim(),
          valor: parseMoneyFlexible(doc && doc.valor),
          item: String((doc && doc.item) || '').trim(),
          categoria: String((doc && doc.categoria) || '').trim(),
          data_faturamento_original: String((doc && (doc.data_faturamento_original || doc.data_faturamento)) || '').trim(),
          data_faturamento: String((doc && (doc.data_faturamento_original || doc.data_faturamento)) || '').trim()
        }))
      };
    }).filter(grupo => grupo.mesReferencia && grupo.valorTotal > 0);
  }

  function agruparMetaConcluidasNFPorMes(docs) {
    const grupos = new Map();

    docs.forEach(doc => {
      if (!grupos.has(doc.mesReferencia)) {
        grupos.set(doc.mesReferencia, {
          mesReferencia: doc.mesReferencia,
          valorTotal: 0,
          itens: new Set(),
          categorias: new Set(),
          nfs: new Set(),
          pedidos: new Set(),
          detalhesDocs: [],
          ultimoTimestamp: doc.dataFaturamentoTimestamp,
          ultimaDataOriginal: doc.dataFaturamentoOriginal
        });
      }

      const grupo = grupos.get(doc.mesReferencia);
      grupo.valorTotal += parseMoneyFlexible(doc.valor);
      if (doc.item) grupo.itens.add(doc.item);
      if (doc.categoria) grupo.categorias.add(doc.categoria);
      if (doc.nf) grupo.nfs.add(doc.nf);
      const pedidosDoc = Array.isArray(doc.numerosPedido) && doc.numerosPedido.length ? doc.numerosPedido : normalizarListaPedidoDisplay(doc.numeroPedido);
      pedidosDoc.forEach(numeroPedido => {
        if (numeroPedido) grupo.pedidos.add(numeroPedido);
      });
      grupo.detalhesDocs.push({
        nf: doc.nf,
        valor: parseMoneyFlexible(doc.valor),
        item: doc.item,
        categoria: doc.categoria,
        numero_pedido: pedidosDoc.join(" / "),
        numeros_pedido: pedidosDoc,
        data_faturamento_original: doc.dataFaturamentoOriginal,
        data_faturamento: doc.dataFaturamentoOriginal
      });

      if (doc.dataFaturamentoTimestamp > grupo.ultimoTimestamp) {
        grupo.ultimoTimestamp = doc.dataFaturamentoTimestamp;
        grupo.ultimaDataOriginal = doc.dataFaturamentoOriginal;
      }
    });

    return Array.from(grupos.values())
      .sort((a, b) => a.ultimoTimestamp - b.ultimoTimestamp)
      .map(grupo => ({
        mesReferencia: grupo.mesReferencia,
        valorTotal: grupo.valorTotal,
        item: Array.from(grupo.itens).join(" / "),
        categoria: Array.from(grupo.categorias).join(" / "),
        nf: Array.from(grupo.nfs).join(" / "),
        numeroPedido: Array.from(grupo.pedidos).join(" / "),
        numerosPedido: Array.from(grupo.pedidos),
        dataFaturamentoOriginal: grupo.ultimaDataOriginal,
        dataFaturamentoTimestamp: grupo.ultimoTimestamp,
        detalhesDocs: grupo.detalhesDocs
      }));
  }

  function expandirLinhasConcluidasPorMes(dados) {
    if (!isFiltroEntregueAtual()) return dados.slice();

    return dados.flatMap(item => {
      const row = Array.isArray(item.content) ? item.content : [];
      const docsValidos = obterMetaConcluidasNF(row);
      if (docsValidos.length === 0) return [item];

      const gruposMensais = agruparMetaConcluidasNFPorMes(docsValidos);
      if (gruposMensais.length === 0) return [item];

      const detalhesBase = safeJsonParse(row[COLS.DETALHES_JSON], {});
      return gruposMensais.map(grupo => {
        const rowClone = row.slice();

        rowClone[COLS.VALOR] = parseMoneyFlexible(grupo.valorTotal);
        rowClone[COLS.DATA_FATURAMENTO] = grupo.dataFaturamentoOriginal || "";
        rowClone[COLS.ITEM_GERAL] = grupo.item || "-";
        rowClone[COLS.CATEGORIA_GERAL] = grupo.categoria || "-";
        rowClone[COLS.NF] = grupo.nf || "";
        rowClone[COLS.OBS] = rowClone[COLS.OBS] || "";

        const detalhesGrupo = Object.assign({}, detalhesBase, {
          meta_concluidas_nf: grupo.detalhesDocs,
          meta_concluidas_por_mes: [{
            mes_referencia: grupo.mesReferencia,
            valor_total: parseMoneyFlexible(grupo.valorTotal),
            nf: grupo.nf || "",
            item: grupo.item || "",
            categoria: grupo.categoria || "",
            data_faturamento_original: grupo.dataFaturamentoOriginal || "",
            data_faturamento: grupo.dataFaturamentoOriginal || "",
            detalhes_nfs: grupo.detalhesDocs
          }]
        });
        rowClone[COLS.DETALHES_JSON] = JSON.stringify(detalhesGrupo);

        return {
          content: rowClone,
          originalIndex: item.originalIndex,
          renderKey: `${item.originalIndex}:${grupo.mesReferencia}`
        };
      });
    });
  }


  function expandirLinhasEntregueFiscalPorMes(dados) {
    return (Array.isArray(dados) ? dados : []).flatMap(item => {
      const row = Array.isArray(item.content) ? item.content : [];
      const docsValidos = obterMetaConcluidasNF(row);
      if (docsValidos.length === 0) return [];

      const gruposMensais = agruparMetaConcluidasNFPorMes(docsValidos);
      if (gruposMensais.length === 0) return [];

      const detalhesBase = safeJsonParse(row[COLS.DETALHES_JSON], {});
      return gruposMensais.map(grupo => {
        const rowClone = row.slice();
        const pedidosGrupo = Array.isArray(grupo.numerosPedido) ? grupo.numerosPedido : normalizarListaPedidoDisplay(grupo.numeroPedido);

        rowClone[COLS.VALOR] = parseMoneyFlexible(grupo.valorTotal);
        rowClone[COLS.DATA_FATURAMENTO] = grupo.dataFaturamentoOriginal || "";
        rowClone[COLS.ITEM_GERAL] = grupo.item || "-";
        rowClone[COLS.CATEGORIA_GERAL] = grupo.categoria || "-";
        rowClone[COLS.NF] = grupo.nf || "";
        rowClone[COLS.STATUS_PROPOSTA] = "ENTREGUE";
        rowClone[COLS.OBS] = rowClone[COLS.OBS] || "";

        const detalhesGrupo = Object.assign({}, detalhesBase, {
          meta_contexto_linha: "ENTREGUE_FISCAL_MES",
          meta_numero_pedido_linha: pedidosGrupo.join(" / "),
          meta_numeros_pedido_linha: pedidosGrupo,
          meta_concluidas_nf: grupo.detalhesDocs,
          meta_concluidas_por_mes: [{
            mes_referencia: grupo.mesReferencia,
            valor_total: parseMoneyFlexible(grupo.valorTotal),
            nf: grupo.nf || "",
            item: grupo.item || "",
            categoria: grupo.categoria || "",
            numero_pedido: pedidosGrupo.join(" / "),
            numeros_pedido: pedidosGrupo,
            data_faturamento_original: grupo.dataFaturamentoOriginal || "",
            data_faturamento: grupo.dataFaturamentoOriginal || "",
            detalhes_nfs: grupo.detalhesDocs
          }]
        });
        rowClone[COLS.DETALHES_JSON] = JSON.stringify(detalhesGrupo);

        return {
          content: rowClone,
          originalIndex: item.originalIndex,
          renderKey: `${item.originalIndex}:entregue-fiscal:${grupo.mesReferencia}:${grupo.nf || pedidosGrupo.join('-') || 'sem-pedido'}`
        };
      });
    });
  }


  function expandirLinhasCarteiraPorPedido(dados) {
    return (Array.isArray(dados) ? dados : []).flatMap(item => {
      const row = Array.isArray(item.content) ? item.content : [];
      const detalhes = safeJsonParse(row[COLS.DETALHES_JSON], {});
      const pedidos = Array.isArray(detalhes.meta_carteira_pedidos) ? detalhes.meta_carteira_pedidos : [];

      return pedidos
        .filter(pedido => pedido && parseMoneyFlexible(pedido.valor) > 0)
        .map((pedido, idx) => {
          const rowClone = row.slice();
          const metaObraKey = String(pedido.meta_obra_key || detalhes.meta_obra_key || '').trim();

          rowClone[COLS.DATA] = pedido.data_firmada || pedido.data || rowClone[COLS.DATA] || "";
          rowClone[COLS.OBRA] = pedido.obra || rowClone[COLS.OBRA] || "";
          rowClone[COLS.CLIENTE] = pedido.cliente || rowClone[COLS.CLIENTE] || "";
          rowClone[COLS.VALOR] = parseMoneyFlexible(pedido.valor);
          rowClone[COLS.DIAS_PRAZO] = pedido.prazo || rowClone[COLS.DIAS_PRAZO] || "";
          rowClone[COLS.OBS] = pedido.observacoes || rowClone[COLS.OBS] || "";
          rowClone[COLS.CPMV] = parseMoneyFlexible(pedido.cpmv || rowClone[COLS.CPMV] || 0);
          rowClone[COLS.ITEM_GERAL] = pedido.item || rowClone[COLS.ITEM_GERAL] || "-";
          rowClone[COLS.CATEGORIA_GERAL] = pedido.categoria || rowClone[COLS.CATEGORIA_GERAL] || "-";
          rowClone[COLS.STATUS_PROPOSTA] = "FIRMADAS";
          rowClone[COLS.DATA_ABERTURA] = pedido.data_abertura || rowClone[COLS.DATA_ABERTURA] || "";
          rowClone[COLS.SEGMENTO] = pedido.segmento || rowClone[COLS.SEGMENTO] || "";
          rowClone[COLS.RESPONSAVEL] = pedido.responsavel || rowClone[COLS.RESPONSAVEL] || "";
          rowClone[COLS.COMPLEXIDADE] = pedido.complexidade || rowClone[COLS.COMPLEXIDADE] || "";
          rowClone[COLS.UF] = pedido.uf || rowClone[COLS.UF] || "";
          rowClone[COLS.ETAPA] = pedido.etapa || rowClone[COLS.ETAPA] || "";
          rowClone[COLS.NF] = pedido.nf || "";
          rowClone[COLS.DATA_FRUSTRADA] = pedido.data_frustrada || "";
          rowClone[COLS.DATA_ENVIADA] = pedido.data_enviada || rowClone[COLS.DATA_ENVIADA] || "";
          rowClone[COLS.DATA_FATURAMENTO] = pedido.data_faturamento || "";

          rowClone[COLS.DETALHES_JSON] = JSON.stringify(Object.assign({}, detalhes, {
            meta_obra_key: metaObraKey,
            meta_numero_pedido: String(pedido.numero_pedido || '').trim(),
            meta_carteira_pedido: pedido
          }));

          return {
            content: rowClone,
            originalIndex: item.originalIndex,
            renderKey: `${item.originalIndex}:carteira:${metaObraKey || rowClone[COLS.OBRA] || 'obra'}:${pedido.numero_pedido || idx}`
          };
        });
    });
  }

  function criarDocsEntregaDoPedido(pedido) {
    const valorPedido = parseMoneyFlexible(pedido && pedido.valor);
    const dataFaturamento = String((pedido && pedido.data_faturamento) || '').trim();
    const docsOriginais = Array.isArray(pedido && pedido.meta_concluidas_nf) ? pedido.meta_concluidas_nf : [];

    if (docsOriginais.length) {
      return docsOriginais.map(doc => ({
        nf: String((doc && doc.nf) || '').trim(),
        valor: parseMoneyFlexible(doc && doc.valor),
        item: String((doc && doc.item) || '').trim(),
        categoria: String((doc && doc.categoria) || '').trim(),
        data_faturamento_original: String((doc && (doc.data_faturamento_original || doc.data_faturamento)) || '').trim(),
        data_faturamento: String((doc && (doc.data_faturamento_original || doc.data_faturamento)) || '').trim()
      })).filter(doc => doc.valor > 0 && doc.data_faturamento);
    }

    if (dataFaturamento && valorPedido > 0) {
      return [{
        nf: String((pedido && pedido.nf) || '').trim(),
        valor: valorPedido,
        item: String((pedido && pedido.item) || '').trim(),
        categoria: String((pedido && pedido.categoria) || '').trim(),
        data_faturamento_original: dataFaturamento,
        data_faturamento: dataFaturamento
      }];
    }

    return [];
  }

  function juntarTextosUnicos(values, separador = " / ") {
    const unicos = [];
    const vistos = new Set();

    (Array.isArray(values) ? values : []).forEach(value => {
      const txt = String(value || '').trim();
      const chave = txt.toUpperCase();
      if (!txt || vistos.has(chave)) return;
      vistos.add(chave);
      unicos.push(txt);
    });

    return unicos.join(separador);
  }

  function criarLinhaEntregueAPartirPedido(item, row, detalhes, pedido, idx) {
    const rowClone = row.slice();
    const metaObraKey = String((pedido && pedido.meta_obra_key) || detalhes.meta_obra_key || '').trim();
    const numeroPedido = String((pedido && pedido.numero_pedido) || '').trim();
    const valorPedido = parseMoneyFlexible(pedido && pedido.valor);
    const dataFaturamento = String((pedido && pedido.data_faturamento) || '').trim();
    const docs = criarDocsEntregaDoPedido(pedido);

    rowClone[COLS.DATA] = (pedido && (pedido.data_firmada || pedido.data)) || rowClone[COLS.DATA] || "";
    rowClone[COLS.OBRA] = (pedido && pedido.obra) || rowClone[COLS.OBRA] || "";
    rowClone[COLS.CLIENTE] = (pedido && pedido.cliente) || rowClone[COLS.CLIENTE] || "";
    rowClone[COLS.VALOR] = valorPedido;
    rowClone[COLS.DIAS_PRAZO] = (pedido && pedido.prazo) || rowClone[COLS.DIAS_PRAZO] || "";
    rowClone[COLS.OBS] = (pedido && pedido.observacoes) || rowClone[COLS.OBS] || "";
    rowClone[COLS.CPMV] = parseMoneyFlexible((pedido && pedido.cpmv) || rowClone[COLS.CPMV] || 0);
    rowClone[COLS.ITEM_GERAL] = (pedido && pedido.item) || rowClone[COLS.ITEM_GERAL] || "-";
    rowClone[COLS.CATEGORIA_GERAL] = (pedido && pedido.categoria) || rowClone[COLS.CATEGORIA_GERAL] || "-";
    rowClone[COLS.STATUS_PROPOSTA] = "ENTREGUE";
    rowClone[COLS.DATA_ABERTURA] = (pedido && pedido.data_abertura) || rowClone[COLS.DATA_ABERTURA] || "";
    rowClone[COLS.SEGMENTO] = (pedido && pedido.segmento) || rowClone[COLS.SEGMENTO] || "";
    rowClone[COLS.RESPONSAVEL] = (pedido && pedido.responsavel) || rowClone[COLS.RESPONSAVEL] || "";
    rowClone[COLS.COMPLEXIDADE] = (pedido && pedido.complexidade) || rowClone[COLS.COMPLEXIDADE] || "";
    rowClone[COLS.UF] = (pedido && pedido.uf) || rowClone[COLS.UF] || "";
    rowClone[COLS.ETAPA] = (pedido && pedido.etapa) || rowClone[COLS.ETAPA] || "";
    rowClone[COLS.NF] = (pedido && pedido.nf) || "";
    rowClone[COLS.DATA_FRUSTRADA] = (pedido && pedido.data_frustrada) || "";
    rowClone[COLS.DATA_ENVIADA] = (pedido && pedido.data_enviada) || rowClone[COLS.DATA_ENVIADA] || "";
    rowClone[COLS.DATA_FATURAMENTO] = dataFaturamento;

    rowClone[COLS.DETALHES_JSON] = JSON.stringify(Object.assign({}, detalhes, {
      meta_obra_key: metaObraKey,
      meta_contexto_linha: "ENTREGUE_PEDIDO",
      meta_numero_pedido_linha: numeroPedido,
      meta_numero_pedido: numeroPedido,
      meta_pedido_operacional: pedido,
      meta_concluidas_nf: docs
    }));

    return {
      content: rowClone,
      originalIndex: item.originalIndex,
      renderKey: `${item.originalIndex}:entregue:${metaObraKey || rowClone[COLS.OBRA] || 'obra'}:${numeroPedido || idx}`
    };
  }

  function criarLinhaEntregueObraCompleta(item, row, detalhes, pedidosEntregues) {
    const rowClone = row.slice();
    const metaObraKey = String(detalhes.meta_obra_key || (pedidosEntregues[0] && pedidosEntregues[0].meta_obra_key) || '').trim();
    const numerosPedido = deduplicarPedidosDisplay(pedidosEntregues.map(pedido => pedido && pedido.numero_pedido));
    const docs = pedidosEntregues.flatMap(pedido => criarDocsEntregaDoPedido(pedido));
    const valorTotal = pedidosEntregues.reduce((acc, pedido) => acc + parseMoneyFlexible(pedido && pedido.valor), 0);
    const ultimoPedido = pedidosEntregues[pedidosEntregues.length - 1] || {};
    const primeiraDataFaturamento = pedidosEntregues.map(pedido => String((pedido && pedido.data_faturamento) || '').trim()).filter(Boolean)[0] || "";

    rowClone[COLS.DATA] = ultimoPedido.data_firmada || ultimoPedido.data || rowClone[COLS.DATA] || "";
    rowClone[COLS.OBRA] = ultimoPedido.obra || rowClone[COLS.OBRA] || "";
    rowClone[COLS.CLIENTE] = ultimoPedido.cliente || rowClone[COLS.CLIENTE] || "";
    rowClone[COLS.VALOR] = valorTotal;
    rowClone[COLS.DIAS_PRAZO] = ultimoPedido.prazo || rowClone[COLS.DIAS_PRAZO] || "";
    rowClone[COLS.OBS] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.observacoes), " • ") || rowClone[COLS.OBS] || "";
    rowClone[COLS.CPMV] = pedidosEntregues.reduce((acc, pedido) => acc + parseMoneyFlexible(pedido && pedido.cpmv), 0);
    rowClone[COLS.ITEM_GERAL] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.item)) || rowClone[COLS.ITEM_GERAL] || "-";
    rowClone[COLS.CATEGORIA_GERAL] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.categoria)) || rowClone[COLS.CATEGORIA_GERAL] || "-";
    rowClone[COLS.STATUS_PROPOSTA] = "ENTREGUE";
    rowClone[COLS.DATA_ABERTURA] = ultimoPedido.data_abertura || rowClone[COLS.DATA_ABERTURA] || "";
    rowClone[COLS.SEGMENTO] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.segmento)) || rowClone[COLS.SEGMENTO] || "";
    rowClone[COLS.RESPONSAVEL] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.responsavel)) || rowClone[COLS.RESPONSAVEL] || "";
    rowClone[COLS.COMPLEXIDADE] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.complexidade)) || rowClone[COLS.COMPLEXIDADE] || "";
    rowClone[COLS.UF] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.uf)) || rowClone[COLS.UF] || "";
    rowClone[COLS.ETAPA] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.etapa)) || rowClone[COLS.ETAPA] || "";
    rowClone[COLS.NF] = juntarTextosUnicos(pedidosEntregues.map(pedido => pedido && pedido.nf));
    rowClone[COLS.DATA_FRUSTRADA] = "";
    rowClone[COLS.DATA_ENVIADA] = rowClone[COLS.DATA_ENVIADA] || "";
    rowClone[COLS.DATA_FATURAMENTO] = primeiraDataFaturamento;

    rowClone[COLS.DETALHES_JSON] = JSON.stringify(Object.assign({}, detalhes, {
      meta_obra_key: metaObraKey,
      meta_contexto_linha: "ENTREGUE_OBRA_COMPLETA",
      meta_numeros_pedido_linha: numerosPedido,
      meta_numero_pedido: numerosPedido.join(" / "),
      meta_pedidos_operacionais_linha: pedidosEntregues,
      meta_concluidas_nf: docs
    }));

    return {
      content: rowClone,
      originalIndex: item.originalIndex,
      renderKey: `${item.originalIndex}:entregue:${metaObraKey || rowClone[COLS.OBRA] || 'obra'}:obra-completa`
    };
  }

  function expandirLinhasEntreguePorPedido(dados) {
    return (Array.isArray(dados) ? dados : []).flatMap(item => {
      const row = Array.isArray(item.content) ? item.content : [];
      const detalhes = safeJsonParse(row[COLS.DETALHES_JSON], {});
      const pedidos = Array.isArray(detalhes.meta_pedidos_operacionais) ? detalhes.meta_pedidos_operacionais : [];
      const pedidosEntregues = pedidos.filter(pedido => pedido && isStatusEntregue(pedido.status_operacional));

      if (!pedidosEntregues.length) return [];

      const pedidosValidos = pedidos.filter(pedido => {
        const status = String((pedido && pedido.status_operacional) || '').trim().toUpperCase();
        return status && status !== 'FRUSTRADAS';
      });
      const todosPedidosValidosEntregues = pedidosValidos.length > 0 && pedidosValidos.every(pedido => isStatusEntregue(pedido.status_operacional));

      if (todosPedidosValidosEntregues) {
        return [criarLinhaEntregueObraCompleta(item, row, detalhes, pedidosEntregues)];
      }

      return pedidosEntregues.map((pedido, idx) => criarLinhaEntregueAPartirPedido(item, row, detalhes, pedido, idx));
    });
  }


  function getObraKeyResumo(row) {
    const detalhes = safeJsonParse(row && row[COLS.DETALHES_JSON], {});
    const metaKey = String(detalhes.meta_obra_key || '').trim();
    if (metaKey) return metaKey;

    const obra = String((row && row[COLS.OBRA]) || '').trim();
    return getSafeId(obra) || obra;
  }

  function normalizarListaPedidoDisplay(value) {
    if (Array.isArray(value)) {
      return value.map(v => String(v || '').trim()).filter(Boolean);
    }

    return String(value || '')
      .split(/[\/|,]+/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  function deduplicarPedidosDisplay(pedidos) {
    const unicos = [];
    const vistos = new Set();

    pedidos.forEach(pedido => {
      const normalizado = String(pedido || '').trim();
      if (!normalizado || vistos.has(normalizado)) return;
      vistos.add(normalizado);
      unicos.push(normalizado);
    });

    return unicos;
  }

  function getNumeroPedidoDisplay(row) {
    const detalhes = safeJsonParse(row && row[COLS.DETALHES_JSON], {});
    let pedidos = [];

    if (isFiltroEntregueAtual()) {
      if (detalhes.meta_contexto_linha === 'ENTREGUE_FISCAL_MES') {
        pedidos = normalizarListaPedidoDisplay(
          detalhes.meta_numeros_pedido_linha ||
          detalhes.meta_numero_pedido_linha ||
          detalhes.meta_numero_pedido ||
          detalhes.numero_pedido
        );
        return deduplicarPedidosDisplay(pedidos).join(" / ");
      }

      if (detalhes.meta_contexto_linha === 'ENTREGUE_PEDIDO') {
        pedidos = normalizarListaPedidoDisplay(
          detalhes.meta_numero_pedido_linha ||
          detalhes.meta_numero_pedido ||
          (detalhes.meta_pedido_operacional && detalhes.meta_pedido_operacional.numero_pedido) ||
          detalhes.numero_pedido
        );
        return deduplicarPedidosDisplay(pedidos).join(" / ");
      }

      if (detalhes.meta_contexto_linha === 'ENTREGUE_OBRA_COMPLETA') {
        pedidos = normalizarListaPedidoDisplay(
          detalhes.meta_numeros_pedido_linha ||
          detalhes.meta_numero_pedido ||
          detalhes.numero_pedido
        );
        return deduplicarPedidosDisplay(pedidos).join(" / ");
      }
    }

    if (isFiltroCarteiraAtual()) {
      pedidos = normalizarListaPedidoDisplay(
        detalhes.meta_numero_pedido ||
        (detalhes.meta_carteira_pedido && detalhes.meta_carteira_pedido.numero_pedido) ||
        detalhes.numero_pedido
      );
      return deduplicarPedidosDisplay(pedidos).join(" / ");
    }

    if (currentStatusFilter === 'TODAS' || detalhes.meta_todas_aplicado) {
      if (detalhes.meta_todas_consolidado && Array.isArray(detalhes.meta_todas_consolidado.numeros_pedido)) {
        pedidos = pedidos.concat(normalizarListaPedidoDisplay(detalhes.meta_todas_consolidado.numeros_pedido));
      }
      if (Array.isArray(detalhes.meta_numeros_pedido)) {
        pedidos = pedidos.concat(normalizarListaPedidoDisplay(detalhes.meta_numeros_pedido));
      }
      pedidos = pedidos.concat(normalizarListaPedidoDisplay(
        (detalhes.meta_todas_consolidado && detalhes.meta_todas_consolidado.numero_pedido) ||
        detalhes.meta_numero_pedido ||
        detalhes.numero_pedido
      ));
      return deduplicarPedidosDisplay(pedidos).join(" / ");
    }

    if (detalhes.meta_pedido_operacional) {
      pedidos = normalizarListaPedidoDisplay(
        detalhes.meta_numero_pedido ||
        detalhes.meta_pedido_operacional.numero_pedido ||
        detalhes.numero_pedido
      );
      return deduplicarPedidosDisplay(pedidos).join(" / ");
    }

    pedidos = pedidos.concat(normalizarListaPedidoDisplay(
      detalhes.meta_numero_pedido ||
      (detalhes.meta_carteira_pedido && detalhes.meta_carteira_pedido.numero_pedido) ||
      detalhes.numero_pedido
    ));

    if (Array.isArray(detalhes.meta_numeros_pedido)) {
      pedidos = pedidos.concat(normalizarListaPedidoDisplay(detalhes.meta_numeros_pedido));
    }

    if (detalhes.meta_todas_consolidado && Array.isArray(detalhes.meta_todas_consolidado.numeros_pedido)) {
      pedidos = pedidos.concat(normalizarListaPedidoDisplay(detalhes.meta_todas_consolidado.numeros_pedido));
    }

    return deduplicarPedidosDisplay(pedidos).join(" / ");
  }

  function renderPedidoBadge(row) {
    const pedido = getNumeroPedidoDisplay(row);
    if (!pedido) return `<span class="text-muted">-</span>`;
    return `<span title="${escapeHtml(pedido)}">${escapeHtml(pedido)}</span>`;
  }

  function obterObraKeyLinha(row) {
    const detalhes = safeJsonParse(row && row[COLS.DETALHES_JSON], {});
    const metaKey = String(
      detalhes.meta_obra_key ||
      (detalhes.meta_todas_consolidado && detalhes.meta_todas_consolidado.meta_obra_key) ||
      (detalhes.meta_carteira_pedido && detalhes.meta_carteira_pedido.meta_obra_key) ||
      ''
    ).trim();

    if (metaKey) return metaKey;

    if (window.motorCompras && typeof window.motorCompras.normalizarObraKey === 'function') {
      return window.motorCompras.normalizarObraKey(row && row[COLS.OBRA]);
    }

    return String(row && row[COLS.OBRA] || '').replace(/\D/g, '');
  }

  function obterStatusItemPersistido(obraKey, itemNome) {
    if (!obraKey || !itemNome || !window.motorCompras) return null;

    if (typeof window.motorCompras.getStatusItemObraSync === 'function') {
      return window.motorCompras.getStatusItemObraSync(obraKey, itemNome);
    }

    return null;
  }

  function obterVinculoOcItemPersistido(obraKey, itemNome) {
    if (!obraKey || !itemNome || !window.motorCompras) return null;

    if (typeof window.motorCompras.getVinculoOcItemSync === 'function') {
      return window.motorCompras.getVinculoOcItemSync(obraKey, itemNome);
    }

    return null;
  }

  function statusPersistidoParaValorTabela(statusItem) {
    const status = String(statusItem || '').trim().toUpperCase();
    if (status === 'OK') return 'OK';
    if (status === 'PENDENTE' || status === '?' || status === 'DUVIDA' || status === 'DÚVIDA') return '?';
    if (status === 'N/A' || status === 'NA' || status === 'NAO_APLICA' || status === 'NÃO_APLICA') return 'N/A';
    return '';
  }

  function aplicarStatusItensPersistidos(dados) {
    if (!Array.isArray(dados) || !window.motorCompras) return dados;

    return dados.map(item => {
      const row = Array.isArray(item.content) ? item.content : [];
      if (!row.length) return item;

      const obraKey = obterObraKeyLinha(row);
      if (!obraKey) return item;

      let alterou = false;
      const rowClone = row.slice();
      const detalhes = safeJsonParse(rowClone[COLS.DETALHES_JSON], {});

      ITENS.forEach((itemNome, idx) => {
        const sid = getSafeId(itemNome);
        const statusSalvo = obterStatusItemPersistido(obraKey, itemNome);
        const vinculoSalvo = obterVinculoOcItemPersistido(obraKey, itemNome);

        if (!statusSalvo && !vinculoSalvo) return;

        const valorStatus = statusPersistidoParaValorTabela(
          statusSalvo && statusSalvo.status_item ? statusSalvo.status_item : (vinculoSalvo ? 'OK' : '')
        );

        if (!valorStatus) return;

        alterou = true;
        rowClone[COLS.ITEM_INICIO + idx] = valorStatus;

        const detAtual = detalhes[sid] && typeof detalhes[sid] === 'object' ? Object.assign({}, detalhes[sid]) : {};
        const obsStatus = statusSalvo && statusSalvo.observacao ? String(statusSalvo.observacao).trim() : '';
        const obsVinculo = vinculoSalvo && vinculoSalvo.observacao ? String(vinculoSalvo.observacao).trim() : '';

        if (valorStatus === 'OK') {
          const fonte = vinculoSalvo || statusSalvo || {};
          if (fonte.pednum) detAtual.oc = String(fonte.pednum || '').trim();
          if (fonte.fornecedor) detAtual.fornecedor = String(fonte.fornecedor || '').trim();
          if (fonte.valor !== undefined && fonte.valor !== null && String(fonte.valor).trim() !== '') {
            detAtual.preco = String(parseMoneyFlexible(fonte.valor));
          }
          if (fonte.data_entrega) detAtual.chegada = String(fonte.data_entrega || '').trim();
          if (obsVinculo || obsStatus) detAtual.descricao = obsVinculo || obsStatus;
        } else if (valorStatus === '?') {
          detAtual.alerta_descricao = obsStatus || detAtual.alerta_descricao || 'Pendência registrada.';
        } else if (valorStatus === 'N/A') {
          detAtual.descricao = obsStatus || detAtual.descricao || '';
        }

        detalhes[sid] = detAtual;
      });

      if (!alterou) return item;

      rowClone[COLS.DETALHES_JSON] = JSON.stringify(detalhes);
      return Object.assign({}, item, { content: rowClone });
    });
  }

  async function carregarStatusItensPersistidos() {
    if (!window.motorCompras) return;

    const tarefas = [];
    if (typeof window.motorCompras.fetchVinculosOcItem === 'function') tarefas.push(window.motorCompras.fetchVinculosOcItem());
    if (typeof window.motorCompras.fetchStatusItensObra === 'function') tarefas.push(window.motorCompras.fetchStatusItensObra());

    if (!tarefas.length) return;

    try {
      await Promise.allSettled(tarefas);
    } catch (_) {
      // Falha de status externo não pode impedir a carteira principal.
    }
  }


  function aplicarMetaTodasConsolidado(dados) {
    return (Array.isArray(dados) ? dados : []).map(item => {
      const row = Array.isArray(item.content) ? item.content : [];
      const detalhes = safeJsonParse(row[COLS.DETALHES_JSON], {});
      const meta = detalhes && typeof detalhes.meta_todas_consolidado === 'object' ? detalhes.meta_todas_consolidado : null;

      if (!meta) return item;

      const rowClone = row.slice();
      const metaObraKey = String(meta.meta_obra_key || detalhes.meta_obra_key || '').trim();

      rowClone[COLS.DATA] = meta.data_firmada || meta.data || rowClone[COLS.DATA] || "";
      rowClone[COLS.OBRA] = meta.obra || rowClone[COLS.OBRA] || "";
      rowClone[COLS.CLIENTE] = meta.cliente || rowClone[COLS.CLIENTE] || "";
      rowClone[COLS.VALOR] = parseMoneyFlexible(meta.valor);
      rowClone[COLS.DIAS_PRAZO] = meta.prazo || rowClone[COLS.DIAS_PRAZO] || "";
      rowClone[COLS.OBS] = meta.observacoes || rowClone[COLS.OBS] || "";
      rowClone[COLS.CPMV] = parseMoneyFlexible(meta.cpmv || rowClone[COLS.CPMV] || 0);
      rowClone[COLS.ITEM_GERAL] = meta.item || rowClone[COLS.ITEM_GERAL] || "-";
      rowClone[COLS.CATEGORIA_GERAL] = meta.categoria || rowClone[COLS.CATEGORIA_GERAL] || "-";
      rowClone[COLS.DATA_ABERTURA] = meta.data_abertura || rowClone[COLS.DATA_ABERTURA] || "";
      rowClone[COLS.SEGMENTO] = meta.segmento || rowClone[COLS.SEGMENTO] || "";
      rowClone[COLS.RESPONSAVEL] = meta.responsavel || rowClone[COLS.RESPONSAVEL] || "";
      rowClone[COLS.COMPLEXIDADE] = meta.complexidade || rowClone[COLS.COMPLEXIDADE] || "";
      rowClone[COLS.UF] = meta.uf || rowClone[COLS.UF] || "";
      rowClone[COLS.ETAPA] = meta.etapa || rowClone[COLS.ETAPA] || "";
      rowClone[COLS.NF] = meta.nf || rowClone[COLS.NF] || "";
      rowClone[COLS.DATA_FRUSTRADA] = meta.data_frustrada || rowClone[COLS.DATA_FRUSTRADA] || "";
      rowClone[COLS.DATA_ENVIADA] = meta.data_enviada || rowClone[COLS.DATA_ENVIADA] || "";
      rowClone[COLS.DATA_FATURAMENTO] = meta.data_faturamento || rowClone[COLS.DATA_FATURAMENTO] || "";

      rowClone[COLS.DETALHES_JSON] = JSON.stringify(Object.assign({}, detalhes, {
        meta_obra_key: metaObraKey,
        meta_numero_pedido: meta.numero_pedido || detalhes.meta_numero_pedido || "",
        meta_numeros_pedido: Array.isArray(meta.numeros_pedido) ? meta.numeros_pedido : detalhes.meta_numeros_pedido,
        meta_todas_aplicado: true
      }));

      return {
        content: rowClone,
        originalIndex: item.originalIndex,
        renderKey: `${item.originalIndex}:todas`
      };
    });
  }


function setFilter(status) {
    currentStatusFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      const btnStatus = btn.getAttribute('data-status');
      if (btnStatus === status || (isStatusEntregue(btnStatus) && isStatusEntregue(status))) {
        btn.classList.add('active');
      }
    });
    const selectEl = document.getElementById('statusFilter');
    if (selectEl && selectEl.value !== status) {
      selectEl.value = isStatusEntregue(status) ? 'ENTREGUE' : status;
    }
    atualizarVisibilidadeFiltroConcluidas();
    sincronizarFiltroConcluidasNaInterface();
    renderizar(dadosLocais.slice(1));
  }

  function getSafeId(str) { 
    if (!str) return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
  }

  function notify(m) {
    const area = document.getElementById('notificationArea');
    const t = document.createElement('div');
    t.className = 'custom-toast';
    t.innerHTML = m;
    area.appendChild(t);
    setTimeout(() => t.remove(), 4000); 
  }
  
  function showAnalyticsSoon() {
    notify("<i class='bi bi-bar-chart-line me-2'></i> O painel Analítico será disponibilizado em breve.");
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function extrairMensagemErro(err) {
    if (!err) return "Erro inesperado.";
    if (typeof err === "string") return err;
    return err.message || err.toString() || "Erro inesperado.";
  }

  function callServer(method, args, onSuccess, onError) {
    let settled = false;
    const timeoutMs = method === 'sincronizarEFetch' ? 30000 : 20000;

    function finalizeSuccess(payload) {
      if (settled) return;
      settled = true;
      if (typeof onSuccess === "function") onSuccess(payload);
    }

    function finalizeError(error) {
      if (settled) return;
      settled = true;
      const msg = extrairMensagemErro(error);
      if (typeof onError === "function") onError(msg);
      else notify(msg);
    }

    const timer = setTimeout(() => {
      finalizeError(`Tempo excedido ao executar requisição ao banco de dados.`);
    }, timeoutMs);

    try {
      if (typeof window.motorBackend === "undefined") {
        clearTimeout(timer);
        const diagHtml = `
          <div style="text-align:center; padding: 30px;">
            <i class="bi bi-file-earmark-x text-danger d-block mb-3" style="font-size: 3.5rem;"></i>
            <h4 class="text-danger fw-bold">ARQUIVO DO MOTOR NÃO ENCONTRADO</h4>
            <p class="text-muted mt-2">O navegador tentou ligar o motor do Supabase, mas o arquivo não foi carregado.</p>
          </div>
        `;
        document.getElementById('tabBody').innerHTML = `<tr><td colspan="20">${diagHtml}</td></tr>`;
        const mobileContainer = document.getElementById('mobileCardsContainer');
        if (mobileContainer) mobileContainer.innerHTML = `<div class="text-center py-5 text-danger px-3">${diagHtml}</div>`;
        finalizeError(`motorbackend.js ausente.`);
        return;
      }

      if (typeof window.motorBackend[method] !== "function") {
        clearTimeout(timer);
        finalizeError(`Função do backend não encontrada: ${method}.`);
        return;
      }

      window.motorBackend[method].apply(null, Array.isArray(args) ? args : [])
        .then(result => {
          clearTimeout(timer);
          finalizeSuccess(result);
        })
        .catch(err => {
          clearTimeout(timer);
          finalizeError(err);
        });

    } catch (e) {
      clearTimeout(timer);
      finalizeError(e);
    }
  }

  function safeJsonParse(value, fallback = {}) {
    if (!value || typeof value !== "string") return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function parseDataUniversal(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getTime());
    if (typeof s !== "string") return null;
    
    const txt = s.trim();
    if (txt === "-" || txt === "" || txt === "N/A" || txt === "OK" || txt === "?") return null;
    
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
    if (!isNaN(d.getTime())) {
      d.setHours(12, 0, 0, 0); 
      return d;
    }
    
    return null;
  }

  function parseDateBR(s) { return parseDataUniversal(s); }
  function parseDateISO(s) { return parseDataUniversal(s); }

  function formatDateToBRFromISO(iso) {
    const dt = parseDataUniversal(iso);
    if (!dt) return "";
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = String(dt.getFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  function formatDateDisplayBR(value) {
    const dt = parseDataUniversal(String(value || "").trim());
    if (!dt) return String(value || "").trim();
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = String(dt.getFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  function formatPrazoDisplay(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "-";

    if (value instanceof Date || isStatusDate(raw) || /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      return formatDateDisplayBR(raw) || raw;
    }

    return raw;
  }

  function sanitizeInteger(value) {
    const num = parseInt(String(value || "").trim(), 10);
    return Number.isFinite(num) && num >= 0 ? String(num) : "";
  }

  function parseMoneyFlexible(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;

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

  function formatMoneyBR(value) {
    const num = parseMoneyFlexible(value);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function isStatusDate(val) {
    if (typeof val !== "string") return false;
    const s = val.trim();
    return /^\d{2}\/\d{2}\/\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s);
  }

  function isIsoDate(val) {
    if (typeof val !== "string") return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
  }

  function validateFormPrincipal() {
    const obraVal = document.getElementById('obra').value.trim();
    const diasPrazoVal = document.getElementById('dias_prazo').value;
    const valorVal = document.getElementById('valor').value.trim();

    if (!obraVal) return "Insira o Nº da Obra.";
    if (diasPrazoVal !== "") {
      const prazo = parseInt(diasPrazoVal, 10);
      if (!Number.isFinite(prazo) || prazo < 0) return "Dias de prazo inválido.";
    }
    if (valorVal !== "" && !Number.isFinite(parseMoneyFlexible(valorVal))) {
      return "Valor da obra inválido.";
    }

    for (const it of ITENS) {
      const id = getSafeId(it);
      const status = document.getElementById(`${id}_status_hidden`)?.value || "";
      const pedido = document.getElementById(`${id}_ped_val`)?.value || "";
      const chegada = document.getElementById(`${id}_cheg_val`)?.value || "";
      const preco = document.getElementById(`${id}_valor_val`)?.value || "";
      const descPendencia = document.getElementById(`${id}_qdesc_val`)?.value || "";

      if (status && status !== "OK" && status !== "N/A" && status !== "?" && !isStatusDate(status)) {
        return `Status inválido para o item ${it}.`;
      }
      if (status === "OK" && preco === "") {
        return `Informe o valor do item ${it}.`;
      }
      if (status === "?" && !String(descPendencia).trim()) {
        return `Descreva a pendência do item ${it}.`;
      }
      
      if (pedido && parseDataUniversal(pedido) === null) return `Data de pedido inválida no item ${it}.`;
      if (chegada && parseDataUniversal(chegada) === null) return `Data de chegada inválida no item ${it}.`;

      const dtPedido = parseDataUniversal(pedido);
      const dtChegada = parseDataUniversal(chegada);
      if (dtPedido && dtChegada && dtChegada < dtPedido) {
        return `A chegada não pode ser menor que o pedido no item ${it}.`;
      }

      if (preco !== "") {
        const p = parseMoneyFlexible(preco);
        if (!Number.isFinite(p) || p < 0) {
          return `Valor inválido no item ${it}.`;
        }
      }
    }
    return "";
  }

  let dadosLocais = [];
  let linhasRenderizadasAtuais = [];
  let estadoOrdenacao = { key: "", dir: "asc" };
  const mapaOrdenacaoCabecalho = {
    "OBRA": "obra",
    "CLIENTE": "cliente",
    "VALOR": "valor", "PREÇO": "valor",
    "PEDIDO": "pedido",
    "ITEM": "itemGeral",
    "CATEGORIA": "categoriaGeral", "CATEG. / SEGMENTO": "categoriaGeral",
    "STATUS DO PRAZO": "prazo",
    "STATUS DE COMPRAS": "compras",
    "FATUR.": "fatur",
    "ABERTURA": "abertura",
    "FATURAMENTO": "abertura",
    "STATUS": "status",
    "RESPONSÁVEL": "responsavel",
    "COMPLEX.": "complexidade",
    "UF": "uf",
    "ETAPA": "etapa",
    "NF": "nf"
  };
  
  let modalUI; let modalResumoUI; let modalCompraUI; let modalPendenciaUI; let modalObraEl;
  let ocSelecionadaCompraAtual = null;
  let ocDisponiveisCompraAtual = [];
  
  function initModais() {
    modalUI = new bootstrap.Modal(document.getElementById('modalObra'));
    modalResumoUI = new bootstrap.Modal(document.getElementById('modalResumoGeral'));
    modalCompraUI = new bootstrap.Modal(document.getElementById('modalCompraItem'));
    modalPendenciaUI = new bootstrap.Modal(document.getElementById('modalPendenciaItem'));
    modalObraEl = document.getElementById('modalObra');

    const nestedModalIds = ['modalCompraItem', 'modalResumoGeral', 'modalPendenciaItem'];
    nestedModalIds.forEach(modalId => {
      const modalEl = document.getElementById(modalId);
      if (!modalEl) return;
      modalEl.addEventListener('show.bs.modal', function () {
        if (modalObraEl && modalObraEl.classList.contains('show')) document.body.classList.add('child-modal-open');
      });
      modalEl.addEventListener('hidden.bs.modal', function () {
        const aindaTemModalFilhoAberto = nestedModalIds.some(id => { const el = document.getElementById(id); return el && el.classList.contains('show'); });
        if (!aindaTemModalFilhoAberto) document.body.classList.remove('child-modal-open');
        if (modalObraEl && modalObraEl.classList.contains('show')) document.body.classList.add('modal-open');
      });
    });

    if (modalObraEl) {
      modalObraEl.addEventListener('hidden.bs.modal', function () { document.body.classList.remove('child-modal-open'); });
    }
  }

  function configurarCabecalhoData() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear()).slice(-2);
    document.getElementById('txtDataAtual').innerHTML = `<i class="bi bi-calendar3"></i> ${dia}/${mes}/${ano}`;
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    const dias = Math.floor((hoje - inicioAno) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((hoje.getDay() + 1 + dias) / 7);
    document.getElementById('txtSemanaAtual').innerHTML = `<i class="bi bi-calendar-week"></i> Semana ${semana}`;
  }

  function calcularPorcentagem(r) {
    const dataFirmada = normalizarDataZeroHora(parseDataUniversal(r[COLS.DATA]));
    const limite = calcularDataPrevistaRow(r);

    if (!dataFirmada || !limite) {
      return { texto: "-", valor: 0, atrasoDias: 0, atraso: false };
    }

    const hoje = normalizarDataZeroHora(new Date());
    const utcHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const utcFirmada = Date.UTC(dataFirmada.getFullYear(), dataFirmada.getMonth(), dataFirmada.getDate());
    const utcLimite = Date.UTC(limite.getFullYear(), limite.getMonth(), limite.getDate());

    let diasDecorridos = Math.floor((utcHoje - utcFirmada) / 86400000);
    if (diasDecorridos < 0) diasDecorridos = 0;

    let atraso = 0;
    let estaAtrasado = false;

    if (utcHoje > utcLimite) {
      estaAtrasado = true;
      atraso = Math.floor((utcHoje - utcLimite) / 86400000);
    }

    return { texto: diasDecorridos + "d", valor: diasDecorridos, atrasoDias: atraso, atraso: estaAtrasado };
  }

  function calcularStatusComprasVirtual(r) {
    let totalAplicavel = 0;
    let totalComprado = 0;
    const detalhesJson = safeJsonParse(r[COLS.DETALHES_JSON], {});

    for (let j = COLS.ITEM_INICIO; j <= COLS.ITEM_FIM; j++) {
      const itemNome = ITENS[j - COLS.ITEM_INICIO];
      if (itemNome === "FATUR.") continue;

      const status = String(r[j] || "").trim();
      if (status === "" || status === "N/A") continue;

      totalAplicavel += 1;
      const id = getSafeId(itemNome);
      const det = detalhesJson[id] || {};

      const temChegada = det.chegada && parseDataUniversal(det.chegada) !== null;
      const temPedido = det.pedido && parseDataUniversal(det.pedido) !== null;

      if (status === "OK" || isStatusDate(status) || temChegada || temPedido) {
        totalComprado += 1;
      }
    }

    if (totalAplicavel === 0) return { texto: "-", valor: 0 };
    const pct = Math.round((totalComprado / totalAplicavel) * 100);
    return { texto: `${pct}%`, valor: pct };
  }
  
  function getSortIcon(headerLabel) {
    const chave = mapaOrdenacaoCabecalho[headerLabel];
    if (!chave) return `<i class="bi bi-chevron-expand sort-icon-neutral"></i>`;
    if (estadoOrdenacao.key !== chave) return `<i class="bi bi-chevron-expand sort-icon-neutral"></i>`;
    return estadoOrdenacao.dir === 'asc' ? `<i class="bi bi-chevron-up"></i>` : `<i class="bi bi-chevron-down"></i>`;
  }

  function toggleOrdenacao(chave) {
    if (!chave) return;
    if (estadoOrdenacao.key === chave) {
      estadoOrdenacao.dir = estadoOrdenacao.dir === 'asc' ? 'desc' : 'asc';
    } else {
      estadoOrdenacao = { key: chave, dir: chave === 'cliente' ? 'asc' : 'desc' };
    }
    renderizar(dadosLocais.slice(1));
  }

  function parseStatusDateValue(valor) {
    const txt = String(valor || "").trim();
    if (!txt || txt === "N/A" || txt === "OK" || txt === "?") return null;
    const d = parseDataUniversal(txt);
    return d ? d.getTime() : null;
  }

  function compararValores(a, b, dir = 'asc') {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'string' && typeof b === 'string') {
      return dir === 'asc' ? a.localeCompare(b, 'pt-BR', { numeric: true }) : b.localeCompare(a, 'pt-BR', { numeric: true });
    }
    return dir === 'asc' ? a - b : b - a;
  }

  function ordenarDados(dados) {
    const chave = estadoOrdenacao.key;
    if (!chave) return dados.slice();

    return dados.slice().sort((itemA, itemB) => {
      const rA = Array.isArray(itemA.content) ? itemA.content : [];
      const rB = Array.isArray(itemB.content) ? itemB.content : [];

      let valorA = null; let valorB = null;

      if (chave === 'obra') { valorA = String(rA[COLS.OBRA] || '').trim(); valorB = String(rB[COLS.OBRA] || '').trim(); } 
      else if (chave === 'cliente') { valorA = String(rA[COLS.CLIENTE] || '').trim(); valorB = String(rB[COLS.CLIENTE] || '').trim(); } 
      else if (chave === 'valor') { valorA = parseMoneyFlexible(rA[COLS.VALOR]); valorB = parseMoneyFlexible(rB[COLS.VALOR]); } 
      else if (chave === 'pedido') { valorA = getNumeroPedidoDisplay(rA); valorB = getNumeroPedidoDisplay(rB); }
      else if (chave === 'itemGeral') { valorA = String(rA[COLS.ITEM_GERAL] || '').trim(); valorB = String(rB[COLS.ITEM_GERAL] || '').trim(); } 
      else if (chave === 'categoriaGeral') { valorA = String(rA[COLS.CATEGORIA_GERAL] || '').trim(); valorB = String(rB[COLS.CATEGORIA_GERAL] || '').trim(); } 
      else if (chave === 'prazo') {
        const pA = calcularPorcentagem(rA); const pB = calcularPorcentagem(rB);
        valorA = pA.atraso ? 1000 + pA.valor : pA.valor; valorB = pB.atraso ? 1000 + pB.valor : pB.valor;
      } 
      else if (chave === 'compras') { valorA = calcularStatusComprasVirtual(rA).valor; valorB = calcularStatusComprasVirtual(rB).valor; } 
      else if (chave === 'fatur') { valorA = parseStatusDateValue(rA[COLS.ITEM_FIM]) ?? -1; valorB = parseStatusDateValue(rB[COLS.ITEM_FIM]) ?? -1; }
      else if (chave === 'abertura') {
        const indiceDataBase = isFiltroEntregueAtual() ? COLS.DATA_FATURAMENTO : COLS.DATA_ABERTURA;
        valorA = parseStatusDateValue(rA[indiceDataBase]) ?? -1;
        valorB = parseStatusDateValue(rB[indiceDataBase]) ?? -1;
      }
      else if (chave === 'status') { valorA = String(rA[COLS.STATUS_PROPOSTA] || '').trim(); valorB = String(rB[COLS.STATUS_PROPOSTA] || '').trim(); }
      else if (chave === 'responsavel') { valorA = String(rA[COLS.RESPONSAVEL] || '').trim(); valorB = String(rB[COLS.RESPONSAVEL] || '').trim(); }
      else if (chave === 'complexidade') { valorA = String(rA[COLS.COMPLEXIDADE] || '').trim(); valorB = String(rB[COLS.COMPLEXIDADE] || '').trim(); }
      else if (chave === 'uf') { valorA = String(rA[COLS.UF] || '').trim(); valorB = String(rB[COLS.UF] || '').trim(); }
      else if (chave === 'etapa') { valorA = String(rA[COLS.ETAPA] || '').trim(); valorB = String(rB[COLS.ETAPA] || '').trim(); }
      else if (chave === 'nf') { valorA = String(rA[COLS.NF] || '').trim(); valorB = String(rB[COLS.NF] || '').trim(); }

      const resultado = compararValores(valorA, valorB, estadoOrdenacao.dir);
      if (resultado !== 0) return resultado;
      return String(rA[COLS.OBRA] || '').localeCompare(String(rB[COLS.OBRA] || ''), 'pt-BR', { numeric: true });
    });
  }

  function lidarCliqueLinha(idx) {
    if (!dadosLocais[idx] || !Array.isArray(dadosLocais[idx].content)) return;
    const r = dadosLocais[idx].content;
    const status = String(r[COLS.STATUS_PROPOSTA] || '').trim();
    
    if (status === 'FIRMADAS') {
      editar(idx);
    } else {
      abrirResumoProposta(idx);
    }
  }

  function abrirLinhaRenderizada(idxRender) {
    const registro = linhasRenderizadasAtuais[idxRender];
    if (!registro || !Array.isArray(registro.content)) return;

    const r = registro.content;
    const status = String(r[COLS.STATUS_PROPOSTA] || '').trim();

    if (status === 'FIRMADAS' && Number.isInteger(registro.originalIndex) && dadosLocais[registro.originalIndex]) {
      editar(registro.originalIndex);
      return;
    }

    abrirResumoPropostaConteudo(r);
  }

  function abrirResumoProposta(idx) {
    if (!dadosLocais[idx] || !Array.isArray(dadosLocais[idx].content)) return;
    abrirResumoPropostaConteudo(dadosLocais[idx].content);
  }

  function abrirResumoPropostaConteudo(r) {
    const obra = String(r[COLS.OBRA] || "").trim();
    const status = String(r[COLS.STATUS_PROPOSTA] || "-").trim() || "-";
    const valor = parseMoneyFlexible(r[COLS.VALOR]);
    const cliente = String(r[COLS.CLIENTE] || "-").trim() || "-";
    const item = String(r[COLS.ITEM_GERAL] || "-").trim() || "-";
    const categoria = String(r[COLS.CATEGORIA_GERAL] || "-").trim() || "-";
    const responsavel = String(r[COLS.RESPONSAVEL] || "-").trim() || "-";
    const complexidade = String(r[COLS.COMPLEXIDADE] || "-").trim() || "-";
    const uf = String(r[COLS.UF] || "").trim();
    const etapa = String(r[COLS.ETAPA] || "-").trim() || "-";
    const nf = String(r[COLS.NF] || "-").trim() || "-";
    const observacoes = String(r[COLS.OBS] || "").trim();

    const mapaUF = {
      AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
      ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
      PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
      RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins"
    };

    const ufNormalizada = uf.toUpperCase();
    const localizacao = ufNormalizada
      ? (mapaUF[ufNormalizada] ? `${mapaUF[ufNormalizada]} (${ufNormalizada})` : ufNormalizada)
      : "UF não informada";

    const statusConfig = {
      ENVIADAS: { chip: "is-info", label: "ENVIADA", icon: "bi-send-check" },
      FRUSTRADAS: { chip: "is-danger", label: "FRUSTRADA", icon: "bi-x-octagon" },
      ENTREGUE: { chip: "is-success", label: "ENTREGUE", icon: "bi-check-circle" },
      CONCLUIDAS: { chip: "is-success", label: "ENTREGUE", icon: "bi-check-circle" },
      ENTREGUES: { chip: "is-success", label: "ENTREGUE", icon: "bi-truck" },
      FIRMADAS: { chip: "is-primary", label: "FIRMADA", icon: "bi-award" }
    };

    const statusMeta = statusConfig[isStatusEntregue(status) ? 'ENTREGUE' : status] || { chip: "is-neutral", label: status || "NÃO INFORMADO", icon: "bi-info-circle" };

    const dataAbertura = formatDateDisplayBR(r[COLS.DATA_ABERTURA]) || "-";
    let dataSecundariaLabel = "Atualização";
    let dataSecundariaValor = "-";

    if (status === 'ENVIADAS') {
      dataSecundariaLabel = 'Envio';
      dataSecundariaValor = formatDateDisplayBR(r[COLS.DATA_ENVIADA]) || '-';
    } else if (status === 'FRUSTRADAS') {
      dataSecundariaLabel = 'Frustração';
      dataSecundariaValor = formatDateDisplayBR(r[COLS.DATA_FRUSTRADA]) || '-';
    } else if (isStatusEntregue(status)) {
      dataSecundariaLabel = 'Faturamento';
      dataSecundariaValor = formatDateDisplayBR(r[COLS.DATA_FATURAMENTO]) || '-';
    }

    const registros = [];
    if (nf && nf !== '-') registros.push(`<p><strong>NF(s) emitidas:</strong> ${escapeHtml(nf)}</p>`);
    if (item && item !== '-') registros.push(`<p><strong>Itens atrelados no ERP:</strong> ${escapeHtml(item)}</p>`);
    if (etapa && etapa !== '-') registros.push(`<p><strong>Etapa registrada:</strong> ${escapeHtml(etapa)}</p>`);
    if (observacoes) registros.push(`<p><strong>Observações:</strong> ${escapeHtml(observacoes)}</p>`);
    if (!registros.length) {
      registros.push(`<p><strong>Registros:</strong> Não há observações adicionais retornadas pelo ERP para esta obra.</p>`);
    }

    const html = `
      <div class="proposta-consulta-page">
        <section class="proposta-consulta-hero">
          <article class="proposta-hero-card proposta-hero-card-main">
            <span class="proposta-obra-badge">OBRA #${escapeHtml(obra || '-')}</span>
            <h2>${escapeHtml(cliente)}</h2>
            <div class="proposta-hero-location"><i class="bi bi-geo-alt"></i><span>${escapeHtml(localizacao)}</span></div>
            <div class="proposta-chip-row">
              <span class="proposta-chip ${statusMeta.chip}"><i class="bi ${statusMeta.icon}"></i>${escapeHtml(statusMeta.label)}</span>
              <span class="proposta-chip"><i class="bi bi-tag"></i>${escapeHtml(categoria)}</span>
            </div>
          </article>
        </section>

        <section class="proposta-consulta-value-row">
          <article class="proposta-hero-card proposta-hero-card-value">
            <span>VALOR DA PROPOSTA</span>
            <strong>R$ ${formatMoneyBR(valor)}</strong>
          </article>
        </section>

        <section class="proposta-consulta-grid">
          <article class="proposta-panel">
            <header class="proposta-panel-head">
              <div class="proposta-panel-title"><i class="bi bi-box-seam"></i><span>DETALHES DO EQUIPAMENTO</span></div>
            </header>
            <div class="proposta-panel-body proposta-panel-body-stack">
              <div class="proposta-field-block">
                <span>DESCRIÇÃO DO ITEM</span>
                <div class="proposta-field-highlight">${escapeHtml(item)}</div>
              </div>
              <div class="proposta-info-list">
                <div class="proposta-info-item">
                  <span class="proposta-info-icon"><i class="bi bi-person"></i></span>
                  <div>
                    <small>RESPONSÁVEL TÉCNICO</small>
                    <strong>${escapeHtml(responsavel)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article class="proposta-panel">
            <header class="proposta-panel-head">
              <div class="proposta-panel-title"><i class="bi bi-clock-history"></i><span>PRAZOS &amp; DOCUMENTAÇÃO</span></div>
            </header>
            <div class="proposta-panel-body proposta-panel-body-stack">
              <div class="proposta-mini-grid">
                <div class="proposta-mini-card">
                  <span><i class="bi bi-calendar-event"></i>ABERTURA</span>
                  <strong>${escapeHtml(dataAbertura)}</strong>
                </div>
                <div class="proposta-mini-card">
                  <span><i class="bi bi-calendar-check"></i>${escapeHtml(dataSecundariaLabel.toUpperCase())}</span>
                  <strong>${escapeHtml(dataSecundariaValor)}</strong>
                </div>
              </div>
              <div class="proposta-mini-card proposta-mini-card-single">
                <span><i class="bi bi-receipt-cutoff"></i>NOTA FISCAL VINCULADA</span>
                <strong>${escapeHtml(nf)}</strong>
              </div>
            </div>
          </article>
        </section>

        <article class="proposta-panel proposta-panel-full">
          <header class="proposta-panel-head">
            <div class="proposta-panel-title"><i class="bi bi-journal-text"></i><span>REGISTROS E OBSERVAÇÕES DO ERP</span></div>
          </header>
          <div class="proposta-panel-body">
            <div class="proposta-note-box">
              ${registros.join('')}
            </div>
          </div>
        </article>
      </div>
    `;

    document.getElementById('tituloResumo').innerText = "Resumo da Obra - " + obra;
    document.getElementById('corpoResumoGeral').innerHTML = html;
    modalResumoUI.show();
  }

  function renderizar(dadosOriginais) {
    const head = document.getElementById('tabHead');
    const body = document.getElementById('tabBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    atualizarVisibilidadeFiltroConcluidas();
    sincronizarFiltroConcluidasNaInterface();

    let dadosPreparados;

    if (isFiltroCarteiraAtual()) {
      dadosPreparados = expandirLinhasCarteiraPorPedido(dadosOriginais);
    } else if (isFiltroEntregueAtual()) {
      const dadosEntregueFiscal = expandirLinhasEntregueFiscalPorMes(dadosOriginais);
      const dadosFiltradosStatus = dadosOriginais.filter(d => {
        return statusLinhaCorrespondeFiltro(d.content[COLS.STATUS_PROPOSTA]);
      });
      dadosPreparados = dadosEntregueFiscal.length
        ? dadosEntregueFiscal
        : expandirLinhasConcluidasPorMes(dadosFiltradosStatus);
    } else {
      const dadosFiltradosStatus = dadosOriginais.filter(d => {
        return statusLinhaCorrespondeFiltro(d.content[COLS.STATUS_PROPOSTA]);
      });

      if (currentStatusFilter === 'TODAS') {
        dadosPreparados = aplicarMetaTodasConsolidado(dadosFiltradosStatus);
      } else {
        dadosPreparados = dadosFiltradosStatus.slice();
      }
    }

    const dadosComStatusPersistido = aplicarStatusItensPersistidos(dadosPreparados);
    const dados = dadosComStatusPersistido.filter(d => linhaConcluidaDentroDoPeriodo(d.content));
    const dadosOrdenados = ordenarDados(dados);
    linhasRenderizadasAtuais = dadosOrdenados.slice();
    const isGeralView = currentStatusFilter !== 'FIRMADAS';
    
    let html = "";
    let htmlMobile = "";
    let totVal = 0;
    let maiorAtraso = { texto: "-", valor: 0 };
    
    const totalOrcadoGeral = dadosOrdenados.reduce((acc, d) => acc + parseMoneyFlexible(d.content[COLS.VALOR]), 0);

    if (!isGeralView) {
      // CABEÇALHO DESKTOP - FIRMADAS
      const labs = ["OBRA", "VALOR", "PEDIDO", "CLIENTE", "ITEM", "CATEGORIA", "STATUS DO PRAZO", "STATUS DE COMPRAS", ...ITENS, "OBSERVAÇÕES"];
      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave
          ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')"><span>${l}</span>${getSortIcon(l)}</button></th>`
          : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach((dO, renderIdx) => {
        const r = Array.isArray(dO.content) ? dO.content : [];
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        totVal += val;

        if (res.atraso && res.atrasoDias > maiorAtraso.valor) {
          maiorAtraso = { texto: res.atrasoDias + "d ATRASO", valor: res.atrasoDias };
        }

        const detalhesJson = safeJsonParse(r[COLS.DETALHES_JSON], {});

        // LINHA DESKTOP - FIRMADAS
        html += `<tr onclick="abrirLinhaRenderizada(${renderIdx})">`;
        html += `<td>${r[COLS.OBRA] || ""}</td>`;
        html += `<td class="fw-semibold td-read-left">${formatMoneyBR(val)}</td>`;
        html += `<td>${renderPedidoBadge(r)}</td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:200px" title="${escapeHtml(r[COLS.CLIENTE])}">${escapeHtml(r[COLS.CLIENTE] || "")}</div></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${escapeHtml(r[COLS.ITEM_GERAL])}">${escapeHtml(r[COLS.ITEM_GERAL] || "-")}</div></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${escapeHtml(r[COLS.CATEGORIA_GERAL])}">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div></td>`;
        html += `<td><span class="days-badge ${res.atraso ? "days-urgent" : "days-ok"} shadow-sm">${res.texto}</span></td>`;
        html += `<td><span class="days-badge ${resCompras.valor >= 100 ? "days-ok" : "days-urgent"} shadow-sm">${resCompras.texto}</span></td>`;

        let miniBadgesMobile = "";

        for (let j = COLS.ITEM_INICIO; j <= COLS.ITEM_FIM; j++) {
          const c = String(r[j] || "").trim();
          const nomeItem = ITENS[j - COLS.ITEM_INICIO];
          const sid = getSafeId(nomeItem);
          const det = detalhesJson[sid] || {};

          let cl = "status-pill ";
          if (c === "OK") cl += "st-ok";
          else if (c === "N/A") cl += "st-na";
          else if (c === "?") cl += "st-qm";
          else if (isStatusDate(c)) cl += "st-dt";

          let icon = "";
          if (c === "?") {
            icon = det.alerta_descricao ? '<i class="bi bi-chat-left-text ms-1"></i>' : '';
          } else if (isStatusDate(c) && nomeItem !== "FATUR.") {
            icon = det.pedido ? '<i class="bi bi-truck ms-1"></i>' : '<i class="bi bi-cart-plus ms-1" style="color:red"></i>';
          }

          const conteudoCelula = isStatusDate(c) ? formatDateDisplayBR(c) : c;
          const tituloDetalhe = c === "?" ? (det.alerta_descricao || "Pendência registrada") : (det.descricao || "");
          html += `<td><span class="${cl}" title="${escapeHtml(tituloDetalhe)}">${conteudoCelula}${icon}</span></td>`;

          // Cria os chips do Mobile
          if(c !== "N/A" && c !== "") {
              let mbClass = "mc-chip ";
              if (c === "OK") mbClass += "mc-ok";
              else if (c === "?") mbClass += "mc-qm";
              else if (isStatusDate(c)) mbClass += "mc-dt";
              
              miniBadgesMobile += `<div class="${mbClass}"><span class="mc-chip-lbl">${nomeItem}</span><span class="mc-chip-val">${conteudoCelula}</span></div>`;
          }
        }

        const obs = r[COLS.OBS] || "";
        html += `<td><small class="text-muted d-inline-block text-truncate" style="max-width: 150px;" title="${escapeHtml(obs)}">${escapeHtml(obs)}</small></td>`;
        html += `</tr>`;

        // CARTÃO MOBILE - FIRMADAS
        htmlMobile += `
        <div class="mc-card animate-fade-up" onclick="abrirLinhaRenderizada(${renderIdx})">
            <div class="mc-header">
                <div class="mc-obra-wrap">
                    <i class="bi bi-folder2-open"></i>
                    <span class="mc-obra-title">${escapeHtml(r[COLS.OBRA] || "")}</span>
                </div>
                <span class="days-badge ${res.atraso ? "days-urgent" : "days-ok"} shadow-sm">${res.texto}</span>
            </div>
            <div class="mc-body">
                <div class="mc-client text-truncate">${escapeHtml(r[COLS.CLIENTE] || "Cliente não informado")}</div>
                <div class="mc-category text-truncate">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div>
                
                <div class="mc-kpi-grid mt-2">
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Valor</span>
                        <span class="mc-kpi-val text-primary">R$ ${formatMoneyBR(val)}</span>
                    </div>
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Compras</span>
                        <span class="mc-kpi-val ${resCompras.valor >= 100 ? "text-success" : "text-warning"}">${resCompras.texto}</span>
                    </div>
                </div>
            </div>
            ${miniBadgesMobile ? `<div class="mc-footer-scroll"><div class="mc-chips-container">${miniBadgesMobile}</div></div>` : ''}
        </div>
        `;
      });

    } else {
      // CABEÇALHO DESKTOP - GERAL
      const isFrustrada = currentStatusFilter === 'FRUSTRADAS';
      const isConcluida = isFiltroEntregueAtual();
      const labelPrimeiraColunaGeral = isConcluida ? "FATURAMENTO" : "ABERTURA";
      const indicePrimeiraDataGeral = isConcluida ? COLS.DATA_FATURAMENTO : COLS.DATA_ABERTURA;
      const labs = [labelPrimeiraColunaGeral, "OBRA", "VALOR", "PEDIDO", "CLIENTE", "STATUS", "ITEM", "CATEG. / SEGMENTO", "RESPONSÁVEL", "COMPLEX.", "UF", "ETAPA", "PRAZO", "NF", "% ORÇADO"];
      if (isFrustrada) labs.push("DATA FRUSTRADA");

      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave
          ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')"><span>${l}</span>${getSortIcon(l)}</button></th>`
          : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach((dO, renderIdx) => {
        const r = Array.isArray(dO.content) ? dO.content : [];
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        totVal += val;
        
        const pctOrcado = totalOrcadoGeral > 0 ? ((val / totalOrcadoGeral) * 100).toFixed(1) + "%" : "0.0%";
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        
        let statusBadgeClass = "days-badge shadow-sm ";
        const stProp = getStatusDisplay(r[COLS.STATUS_PROPOSTA]);
        if (stProp === 'FRUSTRADAS') statusBadgeClass += "days-urgent";        
        else if (isStatusEntregue(stProp)) statusBadgeClass += "days-ok"; 
        else if (stProp === 'FIRMADAS') statusBadgeClass += "days-info";       
        else if (stProp === 'ENVIADAS') statusBadgeClass += "days-warning";    
        else statusBadgeClass += "bg-light text-secondary";

        // LINHA DESKTOP - GERAL
        html += `<tr onclick="abrirLinhaRenderizada(${renderIdx})">`;
        html += `<td>${formatDateDisplayBR(r[indicePrimeiraDataGeral]) || '-'}</td>`;
        html += `<td><strong>${escapeHtml(r[COLS.OBRA] || "")}</strong></td>`;
        html += `<td class="fw-semibold td-read-left">${formatMoneyBR(val)}</td>`;
        html += `<td>${renderPedidoBadge(r)}</td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:180px" title="${escapeHtml(r[COLS.CLIENTE])}">${escapeHtml(r[COLS.CLIENTE] || "-")}</div></td>`;
        html += `<td><span class="${statusBadgeClass}">${stProp || "-"}</span></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${escapeHtml(r[COLS.ITEM_GERAL])}">${escapeHtml(r[COLS.ITEM_GERAL] || "-")}</div></td>`;
        html += `<td class="td-read-left"><small class="fw-bold">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</small><br><small class="text-muted">${escapeHtml(r[COLS.SEGMENTO] || "-")}</small></td>`;
        html += `<td>${escapeHtml(r[COLS.RESPONSAVEL] || "-")}</td>`;
        html += `<td>${escapeHtml(r[COLS.COMPLEXIDADE] || "-")}</td>`;
        html += `<td>${escapeHtml(r[COLS.UF] || "-")}</td>`;
        html += `<td><div class="text-truncate" style="max-width:120px" title="${escapeHtml(r[COLS.ETAPA])}">${escapeHtml(r[COLS.ETAPA] || "-")}</div></td>`;
        html += `<td>${escapeHtml(formatPrazoDisplay(r[COLS.DIAS_PRAZO]))}</td>`;
        html += `<td>${escapeHtml(r[COLS.NF] || "-")}</td>`;
        html += `<td class="fw-bold text-primary">${pctOrcado}</td>`;
        if (isFrustrada) {
          html += `<td>${formatDateDisplayBR(r[COLS.DATA_FRUSTRADA]) || '-'}</td>`;
        }
        html += `</tr>`;

        // CARTÃO MOBILE - GERAL (Com o Item de 3 palavras e ... )
        let itemStr = String(r[COLS.ITEM_GERAL] || "").trim();
        let words = itemStr.split(/\s+/);
        let itemDisplay = words.length > 3 ? words.slice(0, 3).join(" ") + "..." : (itemStr || "-");

        htmlMobile += `
        <div class="mc-card animate-fade-up" onclick="abrirLinhaRenderizada(${renderIdx})">
            <div class="mc-header">
                <div class="mc-obra-wrap">
                    <i class="bi bi-folder2-open"></i>
                    <span class="mc-obra-title">${escapeHtml(r[COLS.OBRA] || "")}</span>
                </div>
                <span class="${statusBadgeClass}">${stProp || "-"}</span>
            </div>
            <div class="mc-body">
                <div class="mc-client text-truncate">${escapeHtml(r[COLS.CLIENTE] || "Cliente não informado")}</div>
                <div class="mc-category text-truncate">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div>
                
                <div class="mc-kpi-grid mt-2">
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">${isConcluida ? "Faturamento" : "Abertura"}</span>
                        <span class="mc-kpi-val">${formatDateDisplayBR(r[indicePrimeiraDataGeral]) || '-'}</span>
                    </div>
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Valor (${pctOrcado})</span>
                        <span class="mc-kpi-val text-primary">R$ ${formatMoneyBR(val)}</span>
                    </div>
                    <div class="mc-kpi" style="grid-column: span 2;">
                        <span class="mc-kpi-lbl">Item</span>
                        <span class="mc-kpi-val text-truncate" style="max-width: 100%;" title="${escapeHtml(itemStr)}">${escapeHtml(itemDisplay)}</span>
                    </div>
                </div>
            </div>
        </div>
        `;
      });
    }

    if (dados.length === 0) {
      linhasRenderizadasAtuais = [];
      body.innerHTML = `<tr><td colspan="20" class="text-center py-5 text-muted"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 2rem;"></i>Nenhum registro encontrado nesta visualização.</td></tr>`;
      if(mobileContainer) mobileContainer.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 3rem; opacity: 0.5;"></i><p>Nenhuma obra nesta visão.</p></div>`;
    } else {
      body.classList.remove('animate-fade-up');
      void body.offsetWidth;
      body.classList.add('animate-fade-up');
      requestAnimationFrame(() => { body.innerHTML = html; });
      if(mobileContainer) mobileContainer.innerHTML = htmlMobile;
    }

    const qtdObrasResumo = isFiltroCarteiraAtual()
      ? new Set(dadosOrdenados.map(d => getObraKeyResumo(d.content)).filter(Boolean)).size
      : dados.length;
    const custoMedio = qtdObrasResumo > 0 ? (totVal / qtdObrasResumo) : 0;
    document.getElementById('resumoObras').innerText = qtdObrasResumo;
    document.getElementById('resumoValor').innerText = formatMoneyBR(totVal);
    document.getElementById('resumoCustoMedio').innerText = formatMoneyBR(custoMedio);
    document.getElementById('resumoProxima').innerText = currentStatusFilter === 'FIRMADAS' ? maiorAtraso.texto : '-';
    requestAnimationFrame(recalibrarLayoutAplicacao);
  }

  function carregarGrade() {
    document.getElementById('gradeItens').innerHTML = ITENS.map(it => {
      const id = getSafeId(it);
      const isFatur = it === "FATUR.";
      return `<div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 p-1">
        <div class="material-box" id="box_${id}">
          <div class="material-topline mb-2">
            <label class="material-label mb-0" id="lbl_${id}">${it}</label>
            <button type="button" class="material-toggle" onclick="toggleItemBox('${id}')" aria-label="Mostrar detalhes de ${it}">
              <i class="bi bi-chevron-down material-toggle-icon"></i>
            </button>
          </div>
          <div class="mini-status-group d-flex w-100 flex-nowrap" style="gap: 6px;">
            ${!isFatur ? `
            <button type="button" class="mini-status-btn flex-fill" id="btn_ok_${id}" onclick="abrirCompraModoOK('${id}')">OK</button>
            <button type="button" class="mini-status-btn flex-fill" id="btn_na_${id}" onclick="marcarItemNA('${id}')">N/A</button>
            ` : ''}
            <button type="button" class="mini-status-btn flex-fill" id="btn_qm_${id}" onclick="abrirModalPendencia('${id}')">?</button>
            <button type="button" class="mini-status-btn mini-date-btn flex-fill" id="btn_dt_${id}">
              <span class="mini-date-text" id="txt_dt_${id}">${isFatur ? 'DATA' : '<i class="bi bi-calendar3"></i>'}</span>
              <input type="date" class="material-date-input position-absolute top-0 start-0 w-100 h-100 opacity-0" style="cursor:pointer;" id="${id}_date_val" onclick="try{this.showPicker();}catch(e){}" onchange="${isFatur ? `setStatus('${id}', 'DATA')` : `selecionarDataComPopUp('${id}', this.value)`}">
            </button>
          </div>
          <div class="material-body">
            ${!isFatur ? `
            <button type="button" class="item-detail-link" id="btn_edit_${id}" onclick="abrirModalCompra('${id}', (document.getElementById('${id}_status_hidden')?.value === 'OK' ? 'OK' : 'DATA'))">
              <i class="bi bi-cart-plus"></i><span>Detalhes</span>
            </button>` : ''}
          </div>
          <input type="hidden" id="${id}_status_hidden" value="">
          <div style="display:none;">
            <input type="hidden" id="${id}_ped_val"><input type="hidden" id="${id}_cheg_val"><input type="hidden" id="${id}_forn_val">
            <input type="hidden" id="${id}_oc_val"><input type="hidden" id="${id}_valor_val"><input type="hidden" id="${id}_desc_val">
            <input type="hidden" id="${id}_qdesc_val">
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function carregar() {
    document.getElementById('tabBody').innerHTML = `<tr><td colspan="20" class="text-center py-5 text-muted"><div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div><span class="fw-bold">Sincronizando carteira 2026 com o ERP...</span></td></tr>`;
    const mobileContainer = document.getElementById('mobileCardsContainer');
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div class=\"text-center py-5 text-muted\"><div class=\"spinner-border text-primary spinner-border-sm me-2\" role=\"status\"></div><span class=\"fw-bold\">Sincronizando carteira 2026 com o ERP...</span></div>`;
    }
    
    // CHAMADA ORIGINAL COM O FILTRO DE ANO ADICIONADO
    callServer('sincronizarEFetch', [currentAnoFilter], async data => {
      if (!Array.isArray(data) || data.length === 0) { 
        renderizar([]); 
        return; 
      }
      dadosLocais = data.map((r, i) => ({ content: r, originalIndex: i }));
      await carregarStatusItensPersistidos();
      renderizar(dadosLocais.slice(1));
    }, msg => {
      if (msg === "motorbackend.js ausente.") return;

      const erroHtmlDesktop = `
        <tr><td colspan="20" class="text-center py-5 text-danger">
          <i class="bi bi-database-x me-2 d-block mb-3" style="font-size: 2.5rem;"></i>
          <h5 class="fw-bold">Falha ao Ler a Tabela do ERP</h5>
          <span class="text-muted mt-2 d-inline-block" style="font-size:0.9rem;">
            Motivo Retornado pelo Banco:<br>
            <strong class="text-danger">${escapeHtml(msg)}</strong>
          </span><br>
        </td></tr>
      `;
      document.getElementById('tabBody').innerHTML = erroHtmlDesktop;

      const mobileContainer = document.getElementById('mobileCardsContainer');
      if (mobileContainer) {
        mobileContainer.innerHTML = `
          <div class="text-center py-5 text-danger px-3">
            <i class="bi bi-database-x d-block mb-3" style="font-size: 2.5rem;"></i>
            <h5 class="fw-bold">Falha ao Ler a Tabela do ERP</h5>
            <span class="text-muted mt-2 d-inline-block" style="font-size:0.9rem;">
              Motivo Retornado pelo Banco:<br>
              <strong class="text-danger">${escapeHtml(msg)}</strong>
            </span>
          </div>
        `;
      }
    });
  }

  function atualizarResumoItem(id) {
    const hid = document.getElementById(`${id}_status_hidden`); const txt = document.getElementById(`txt_dt_${id}`);
    const btnOk = document.getElementById(`btn_ok_${id}`); const btnNa = document.getElementById(`btn_na_${id}`);
    const btnQm = document.getElementById(`btn_qm_${id}`); const btnDt = document.getElementById(`btn_dt_${id}`);
    const btnEdit = document.getElementById(`btn_edit_${id}`);
    const status = hid ? String(hid.value || '').trim() : '';

    [btnOk, btnNa, btnQm, btnDt].forEach(b => { if (b) b.classList.remove('is-active-ok', 'is-active-na', 'is-active-qm', 'is-active-date'); });
    if (txt) txt.innerHTML = '<i class="bi bi-calendar3"></i>';

    if (status === 'OK') { if (btnOk) btnOk.classList.add('is-active-ok'); } 
    else if (status === 'N/A' || status === '') { if (btnNa) btnNa.classList.add('is-active-na'); } 
    else if (status === '?') { if (btnQm) btnQm.classList.add('is-active-qm'); } 
    else { if (btnDt) btnDt.classList.add('is-active-date'); if (txt) txt.textContent = status; }

    if (btnEdit) btnEdit.style.display = (status && status !== 'N/A' && status !== '?') ? 'inline-flex' : 'none';
  }

  function toggleItemBox(id) { const box = document.getElementById(`box_${id}`); if (box) box.classList.toggle('is-open'); }
  function recolherTodosItens() { document.querySelectorAll('#gradeItens .material-box').forEach(box => box.classList.remove('is-open')); }

  function abrirModalPendencia(id) {
    const hidden = document.getElementById(`${id}_qdesc_val`);
    document.getElementById('pend_current_id').value = id;
    document.getElementById('tituloPendenciaItem').innerText = 'PENDÊNCIA: ' + document.getElementById(`lbl_${id}`).innerText;
    document.getElementById('pop_qdesc').value = hidden ? hidden.value : '';
    modalPendenciaUI.show();
  }

  async function salvarPopUpPendencia() {
    const id = document.getElementById('pend_current_id').value; if (!id) return;
    const descricao = document.getElementById('pop_qdesc').value.trim();
    if (!descricao) { notify('Descreva a pendência do item.'); return; }
    const hidden = document.getElementById(`${id}_qdesc_val`);
    if (hidden) hidden.value = descricao;
    setStatus(id, '?');

    const obra = getObraAtualFormulario();
    const itemLabel = getItemLabelById(id);

    if (obra && itemLabel && window.motorCompras && typeof window.motorCompras.salvarStatusItemObra === 'function') {
      try {
        await window.motorCompras.salvarStatusItemObra(obra, itemLabel, 'PENDENTE', {
          observacao: descricao,
          atualizado_por: 'interface'
        });
        renderizar(dadosLocais.slice(1));
      } catch (err) {
        notify(`<i class='bi bi-exclamation-triangle me-2'></i> ${escapeHtml(extrairMensagemErro(err))}`);
        return;
      }
    }

    modalPendenciaUI.hide();
  }


  function getObraAtualFormulario() {
    return String(document.getElementById('obra')?.value || '').trim();
  }

  function getItemLabelById(id) {
    return String(document.getElementById(`lbl_${id}`)?.innerText || id || '').trim();
  }

  function setModalCompraModoSelecaoOc(ativo) {
    const ocArea = document.getElementById('ocSelectorArea');
    const blocoDetalhado = document.getElementById('camposCompraDetalhada');
    const valorWrap = document.getElementById('pop_valor')?.closest('.mb-3');
    const descWrap = document.getElementById('pop_desc')?.closest('.mb-1');
    const btn = document.getElementById('btnConfirmarCompraItem');

    if (ocArea) ocArea.classList.toggle('d-none', !ativo);
    if (blocoDetalhado) blocoDetalhado.style.display = ativo ? 'none' : '';
    if (valorWrap) valorWrap.style.display = ativo ? 'none' : '';
    if (descWrap) descWrap.style.display = ativo ? 'none' : '';

    if (btn) {
      btn.innerText = ativo ? 'VINCULAR OC E CONFIRMAR OK' : 'CONFIRMAR DADOS';
      btn.disabled = ativo;
    }
  }

  function formatMoneyCompra(valor) {
    return parseMoneyFlexible(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatDateCompraDisplay(value) {
    return formatDateDisplayBR(value);
  }

  function preencherCamposCompraComOC(compra) {
    const safe = compra || {};
    const pedEl = document.getElementById('pop_ped');
    const chegEl = document.getElementById('pop_cheg');
    const fornEl = document.getElementById('pop_forn');
    const ocEl = document.getElementById('pop_oc');
    const valorEl = document.getElementById('pop_valor');
    const descEl = document.getElementById('pop_desc');

    if (pedEl) pedEl.value = safe.cadastramento || "";
    if (chegEl) chegEl.value = safe.data_entrega || "";
    if (fornEl) fornEl.value = safe.fornecedor || "";
    if (ocEl) ocEl.value = safe.pednum || "";
    if (valorEl) valorEl.value = parseMoneyFlexible(safe.valor || 0).toFixed(2).replace('.00', '');
    if (descEl) {
      const nf = safe.nf ? `NF ${safe.nf}` : 'Sem NF';
      const entrega = safe.data_entrega ? `Entrega ${formatDateCompraDisplay(safe.data_entrega)}` : 'Sem entrega';
      descEl.value = `${nf} • ${entrega}${safe.observacoes ? ' • ' + safe.observacoes : ''}`;
    }
  }

  function selecionarOCCompra(pednum) {
    const ped = String(pednum || '').trim();
    const compra = ocDisponiveisCompraAtual.find(item => String(item.pednum || '').trim() === ped);
    if (!compra) return;

    ocSelecionadaCompraAtual = compra;
    preencherCamposCompraComOC(compra);

    document.querySelectorAll('#ocSelectorArea .oc-choice-card').forEach(card => {
      card.classList.toggle('is-selected', card.getAttribute('data-pednum') === ped);
    });

    const btn = document.getElementById('btnConfirmarCompraItem');
    if (btn) btn.disabled = false;
  }

  function renderizarListaOCCompra(compras, vinculoAtual) {
    const area = document.getElementById('ocSelectorArea');
    if (!area) return;

    if (!compras.length) {
      area.innerHTML = `
        <div class="text-center text-muted py-4 px-2">
          <i class="bi bi-inbox d-block mb-2" style="font-size:2rem;"></i>
          <strong>Nenhuma OC válida encontrada para esta obra.</strong>
          <div class="small mt-1">Cadastre a OC na planilha para liberar o OK deste item.</div>
        </div>
      `;
      const btn = document.getElementById('btnConfirmarCompraItem');
      if (btn) btn.disabled = true;
      return;
    }

    area.innerHTML = `
      <div class="mb-3">
        <div class="sub-label mb-2">Selecione a OC vinculada ao item</div>
        <div class="helper-note mb-2">O OK só será confirmado após vincular uma ordem de compra real da planilha.</div>
        <div class="oc-choice-list">
          ${compras.map(compra => {
            const ped = escapeHtml(compra.pednum || '');
            const fornecedor = escapeHtml(compra.fornecedor || 'Fornecedor não informado');
            const nf = compra.nf ? `NF ${escapeHtml(compra.nf)}` : 'Sem NF';
            const entrega = compra.data_entrega ? `Entrega ${escapeHtml(formatDateCompraDisplay(compra.data_entrega))}` : 'Sem entrega';
            const valor = escapeHtml(formatMoneyCompra(compra.valor || 0));
            const obs = escapeHtml(String(compra.observacoes || '').trim());
            return `
              <button type="button" class="oc-choice-card" data-pednum="${ped}" onclick="selecionarOCCompra('${ped.replace(/'/g, "\\'")}')">
                <span class="oc-choice-main">OC ${ped} · ${fornecedor}</span>
                <span class="oc-choice-meta">${nf} · ${entrega}</span>
                <span class="oc-choice-value">R$ ${valor}</span>
                ${obs ? `<span class="oc-choice-obs">${obs}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (vinculoAtual && vinculoAtual.pednum) {
      selecionarOCCompra(vinculoAtual.pednum);
    }
  }

  async function carregarOCsParaItemCompra(id) {
    const area = document.getElementById('ocSelectorArea');
    const btn = document.getElementById('btnConfirmarCompraItem');

    ocSelecionadaCompraAtual = null;
    ocDisponiveisCompraAtual = [];

    if (btn) btn.disabled = true;
    if (area) {
      area.innerHTML = `
        <div class="text-center text-muted py-4">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
          <strong>Carregando OCs da obra...</strong>
        </div>
      `;
    }

    try {
      if (!window.motorCompras || typeof window.motorCompras.getResumoObra !== 'function') {
        throw new Error('Motor de compras não carregado.');
      }

      const obra = getObraAtualFormulario();
      const itemLabel = getItemLabelById(id);
      const resumo = await window.motorCompras.getResumoObra(obra);
      const compras = Array.isArray(resumo.compras) ? resumo.compras.filter(compra => !compra.cancelada && compra.pednum) : [];

      ocDisponiveisCompraAtual = compras;

      let vinculoAtual = null;
      if (window.motorCompras && typeof window.motorCompras.getVinculoOcItem === 'function') {
        vinculoAtual = await window.motorCompras.getVinculoOcItem(obra, itemLabel);
      }

      renderizarListaOCCompra(compras, vinculoAtual);

    } catch (err) {
      if (area) {
        area.innerHTML = `
          <div class="text-center text-danger py-4 px-2">
            <i class="bi bi-exclamation-triangle d-block mb-2" style="font-size:2rem;"></i>
            <strong>Não foi possível carregar as OCs.</strong>
            <div class="small mt-1">${escapeHtml(extrairMensagemErro(err))}</div>
          </div>
        `;
      }
      if (btn) btn.disabled = true;
    }
  }

  function abrirCompraModoOK(id) { abrirModalCompra(id, 'OK'); }
  function selecionarDataComPopUp(id, dateStr) { setStatus(id, 'DATA'); if (dateStr) abrirModalCompra(id, 'DATA'); }

  function abrirModalCompra(id, mode = 'DATA') {
    document.getElementById('compra_current_id').value = id; document.getElementById('compra_current_mode').value = mode;
    document.getElementById('tituloCompraItem').innerText = 'COMPRA: ' + document.getElementById(`lbl_${id}`).innerText;
    const isModoOK = mode === 'OK';
    setModalCompraModoSelecaoOc(isModoOK);

    const inputPed = document.getElementById('pop_ped'); const inputCheg = document.getElementById('pop_cheg');
    const inputForn = document.getElementById('pop_forn'); const inputOc = document.getElementById('pop_oc');
    const inputValor = document.getElementById('pop_valor'); const inputDesc = document.getElementById('pop_desc');

    if (inputPed) inputPed.value = document.getElementById(`${id}_ped_val`).value;
    if (inputCheg) inputCheg.value = document.getElementById(`${id}_cheg_val`).value;
    if (inputForn) inputForn.value = document.getElementById(`${id}_forn_val`).value;
    if (inputOc) inputOc.value = document.getElementById(`${id}_oc_val`).value;
    
    const vRaw = document.getElementById(`${id}_valor_val`).value;
    if (inputValor) inputValor.value = (vRaw !== "" && vRaw !== null) ? parseMoneyFlexible(vRaw).toFixed(2).replace('.00', '') : "";
    
    if (inputDesc) inputDesc.value = document.getElementById(`${id}_desc_val`).value;
    modalCompraUI.show();

    if (isModoOK) {
      carregarOCsParaItemCompra(id);
    }
  }

  async function salvarPopUpCompra() {
    const id = document.getElementById('compra_current_id').value;
    const mode = document.getElementById('compra_current_mode').value || 'DATA';
    if (!id) return;

    if (mode === 'OK') {
      const compra = ocSelecionadaCompraAtual;
      if (!compra || !compra.pednum) {
        notify("<i class='bi bi-link-45deg me-2'></i> Vincule uma OC antes de confirmar OK.");
        return;
      }

      const btn = document.getElementById('btnConfirmarCompraItem');
      const oldHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando vínculo...';
      }

      try {
        const itemLabel = getItemLabelById(id);
        const obra = getObraAtualFormulario();

        if (window.motorCompras && typeof window.motorCompras.salvarVinculoOcItem === 'function') {
          await window.motorCompras.salvarVinculoOcItem(obra, itemLabel, compra, 'interface');
        }

        document.getElementById(`${id}_valor_val`).value = parseMoneyFlexible(compra.valor || 0).toFixed(2).replace('.00', '');
        document.getElementById(`${id}_ped_val`).value = compra.cadastramento || '';
        document.getElementById(`${id}_cheg_val`).value = compra.data_entrega || '';
        document.getElementById(`${id}_forn_val`).value = compra.fornecedor || '';
        document.getElementById(`${id}_oc_val`).value = compra.pednum || '';
        document.getElementById(`${id}_desc_val`).value = `${compra.nf ? 'NF ' + compra.nf + ' • ' : ''}${compra.observacoes || ''}`.trim();

        setStatus(id, 'OK');
        atualizarFaturamentoPrevistoFormulario();
        renderizar(dadosLocais.slice(1));
        modalCompraUI.hide();
        notify("<i class='bi bi-check-circle me-2'></i> OC vinculada ao item com sucesso.");
      } catch (err) {
        notify(`<i class='bi bi-exclamation-triangle me-2'></i> ${escapeHtml(extrairMensagemErro(err))}`);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = oldHtml || 'VINCULAR OC E CONFIRMAR OK';
        }
      }
      return;
    }

    const ped = document.getElementById('pop_ped').value; const cheg = document.getElementById('pop_cheg').value;
    const valor = document.getElementById('pop_valor').value; const forn = document.getElementById('pop_forn').value.trim();
    const oc = document.getElementById('pop_oc').value.trim(); const desc = document.getElementById('pop_desc').value.trim();

    if (valor === '') { notify("Informe o valor do item."); return; }
    if (ped && parseDataUniversal(ped) === null) { notify("Data de pedido inválida."); return; }
    if (cheg && parseDataUniversal(cheg) === null) { notify("Data de chegada inválida."); return; }

    const dtPed = parseDataUniversal(ped); const dtCheg = parseDataUniversal(cheg);
    if (dtPed && dtCheg && dtCheg < dtPed) { notify("A chegada não pode ser menor que o pedido."); return; }

    const numValor = parseMoneyFlexible(valor);
    if (!Number.isFinite(numValor) || numValor < 0) { notify("Valor da compra inválido."); return; }

    document.getElementById(`${id}_valor_val`).value = valor; document.getElementById(`${id}_ped_val`).value = ped;
    document.getElementById(`${id}_cheg_val`).value = cheg; document.getElementById(`${id}_forn_val`).value = forn;
    document.getElementById(`${id}_oc_val`).value = oc; document.getElementById(`${id}_desc_val`).value = desc;

    if (mode === 'OK') { setStatus(id, 'OK'); } else if (document.getElementById(`${id}_date_val`)?.value) { setStatus(id, 'DATA'); }
    atualizarFaturamentoPrevistoFormulario(); modalCompraUI.hide();
  }

  function setStatus(id, val) {
    const hid = document.getElementById(`${id}_status_hidden`); const dat = document.getElementById(`${id}_date_val`);
    const box = document.getElementById(`box_${id}`); const qDesc = document.getElementById(`${id}_qdesc_val`);

    if (!hid) return;
    if (box) box.classList.remove('expanded');

    if (val === 'OK') {
      hid.value = 'OK'; if (dat) dat.value = ''; if (qDesc) qDesc.value = '';
    } else if (val === 'N/A') {
      hid.value = 'N/A'; if (dat) dat.value = ''; limparCamposDetalhesItem(id);
    } else if (val === '?') {
      hid.value = '?'; if (dat) dat.value = '';
    } else if (val === 'DATA') {
      hid.value = formatDateToBRFromISO(dat && dat.value ? dat.value : "");
      if (box) box.classList.add('expanded'); if (qDesc) qDesc.value = '';
    }
    atualizarResumoItem(id); if (id !== 'fatur') atualizarFaturamentoPrevistoFormulario();
  }

  async function marcarItemNA(id) {
    if (!id) return;

    setStatus(id, 'N/A');

    const obra = getObraAtualFormulario();
    const itemLabel = getItemLabelById(id);

    if (obra && itemLabel && window.motorCompras && typeof window.motorCompras.salvarStatusItemObra === 'function') {
      try {
        await window.motorCompras.salvarStatusItemObra(obra, itemLabel, 'N/A', {
          observacao: 'Item marcado como N/A pela interface.',
          atualizado_por: 'interface'
        });
        renderizar(dadosLocais.slice(1));
      } catch (err) {
        notify(`<i class='bi bi-exclamation-triangle me-2'></i> ${escapeHtml(extrairMensagemErro(err))}`);
      }
    }
  }

  function limparCamposDetalhesItem(id) {
    const campos = ['ped_val', 'cheg_val', 'forn_val', 'oc_val', 'valor_val', 'date_val', 'desc_val', 'qdesc_val'];
    campos.forEach(campo => { const el = document.getElementById(`${id}_${campo}`); if (el) el.value = ""; });
  }
  function obterDataFirmadaFormulario() { return normalizarDataZeroHora(parseDataUniversal(document.getElementById('data_entrada_orig')?.value || "")); }

  function obterUltimaChegadaFormulario() {
    let ultima = null;
    ITENS.forEach(it => {
      if (it === "FATUR.") return;
      const id = getSafeId(it); const valor = document.getElementById(`${id}_cheg_val`)?.value || "";
      const dt = normalizarDataZeroHora(parseDataUniversal(valor));
      if (!dt) return; if (!ultima || dt.getTime() > ultima.getTime()) ultima = dt;
    });
    return ultima;
  }

  function calcularFaturamentoPrevistoFormulario() {
    const dataFirmada = obterDataFirmadaFormulario(); if (!dataFirmada) return null;
    const ultimaChegada = obterUltimaChegadaFormulario(); if (ultimaChegada) return addDiasUteis(ultimaChegada, 5);
    return addDiasCorridos(dataFirmada, document.getElementById('dias_prazo')?.value || 0);
  }

  function aplicarStatusDataNoFormulario(id, data) {
    const hid = document.getElementById(`${id}_status_hidden`); const dat = document.getElementById(`${id}_date_val`); const qDesc = document.getElementById(`${id}_qdesc_val`);
    if (!hid || !dat) return;

    if (!data) {
      hid.value = 'N/A'; dat.value = ''; if (qDesc) qDesc.value = ''; atualizarResumoItem(id); return;
    }
    const dt = normalizarDataZeroHora(data);
    const ano = dt.getFullYear(); const mes = String(dt.getMonth() + 1).padStart(2, '0'); const dia = String(dt.getDate()).padStart(2, '0');
    dat.value = `${ano}-${mes}-${dia}`; hid.value = formatDateBRFromDate(dt); if (qDesc) qDesc.value = '';
    atualizarResumoItem(id);
  }

  function atualizarFaturamentoPrevistoFormulario() { const dataPrevista = calcularFaturamentoPrevistoFormulario(); aplicarStatusDataNoFormulario('fatur', dataPrevista); }

  function abrirNovo() { 
    document.getElementById('formPrincipal').reset(); document.getElementById('data_entrada_orig').value = ""; document.getElementById('cpmv_obra_val').value = "";
    ITENS.forEach(it => { const id = getSafeId(it); limparCamposDetalhesItem(id); setStatus(id, 'N/A'); });
    document.getElementById('modalObraTitle').innerText = 'CADASTRO DE OBRA'; document.getElementById('btnFin').style.display = 'none'; document.getElementById('btnGeral').style.display = 'none';
    atualizarFaturamentoPrevistoFormulario(); recolherTodosItens(); modalUI.show(); carregarComprasDaObraNoModal(r); 
  }

  function salvar() {
    const btn = document.getElementById('btnSalvar'); if (!btn || btn.disabled) return;
    const erroValidacao = validateFormPrincipal(); if (erroValidacao) { notify(erroValidacao); return; }
    btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>GRAVANDO...`;

    try {
      atualizarFaturamentoPrevistoFormulario();
      
      const valorLimpo = document.getElementById('valor').value !== "" ? String(parseMoneyFlexible(document.getElementById('valor').value)) : "";
      
      const obj = { 
        data_entrada_orig: document.getElementById('data_entrada_orig').value || "", obra: document.getElementById('obra').value.trim(), 
        cliente: document.getElementById('cliente').value.trim() || "", valor: valorLimpo, 
        dias_prazo: sanitizeInteger(document.getElementById('dias_prazo').value), analise: document.getElementById('analise').value.trim() || "", detalhes_json: {} 
      };

      ITENS.forEach(it => {
        const id = getSafeId(it); 
        const hid = document.getElementById(id + '_status_hidden'); const ped = document.getElementById(id + '_ped_val');
        const cheg = document.getElementById(id + '_cheg_val'); const val = document.getElementById(id + '_valor_val');
        const forn = document.getElementById(id + '_forn_val'); const oc = document.getElementById(id + '_oc_val');
        const desc = document.getElementById(id + '_desc_val'); const qdesc = document.getElementById(id + '_qdesc_val');

        obj[id] = hid ? hid.value : 'N/A';
        obj.detalhes_json[id] = { 
          item_nome: it, pedido: ped ? ped.value : "", chegada: cheg ? cheg.value : "", 
          preco: val && val.value !== "" ? String(parseMoneyFlexible(val.value)) : "0", 
          fornecedor: forn ? forn.value.trim() : "", oc: oc ? oc.value.trim() : "", descricao: desc ? desc.value.trim() : "", alerta_descricao: qdesc ? qdesc.value.trim() : ""
        };
      });

      callServer('salvarProjeto', [obj], res => { 
        btn.disabled = false; btn.innerText = "GRAVAR DADOS"; modalUI.hide(); carregar(); notify(res || "✅ Gravado com sucesso!");
      }, msg => { btn.disabled = false; btn.innerText = "GRAVAR DADOS"; notify("Erro: " + msg); });
    } catch (e) {
      btn.disabled = false; btn.innerText = "GRAVAR DADOS"; notify("Erro no processamento: " + extrairMensagemErro(e)); console.error(e);
    }
  }


  function ensureComprasObraSection() {
    const form = document.getElementById('formPrincipal');
    if (!form) return null;

    let section = document.getElementById('comprasObraSection');
    if (!section) {
      section = document.createElement('section');
      section.id = 'comprasObraSection';
      section.className = 'app-section-card';
      section.innerHTML = `
        <div class="app-section-heading">
          <div>
            <span class="app-section-eyebrow">Compras apropriadas</span>
            <h6>Ordens de compra vinculadas à obra</h6>
          </div>
          <span class="app-section-hint" id="comprasObraHint">Fonte: planilha OC</span>
        </div>
        <div id="comprasObraResumoBody">
          <div class="text-muted small fw-semibold">Carregando compras da obra...</div>
        </div>
      `;
      form.appendChild(section);
    }

    return document.getElementById('comprasObraResumoBody');
  }

  function renderComprasObraVazio(mensagem) {
    const body = ensureComprasObraSection();
    if (!body) return;

    body.innerHTML = `
      <div class="border rounded-3 bg-light p-3 text-muted small fw-semibold">
        <i class="bi bi-info-circle me-1"></i>${escapeHtml(mensagem || 'Nenhuma compra apropriada encontrada para esta obra.')}
      </div>
    `;
  }

  function renderComprasObraErro(mensagem) {
    const body = ensureComprasObraSection();
    if (!body) return;

    body.innerHTML = `
      <div class="border rounded-3 bg-light p-3 text-danger small fw-bold">
        <i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(mensagem || 'Não foi possível carregar as compras apropriadas.')}
      </div>
    `;
  }

  function formatDateCompraDisplay(value) {
    const dt = parseDataUniversal(String(value || '').trim());
    if (!dt) return String(value || '').trim() || '-';
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = String(dt.getFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  function renderComprasObraResumo(resumo) {
    const body = ensureComprasObraSection();
    if (!body) return;

    if (!resumo || !Array.isArray(resumo.compras) || resumo.compras.length === 0) {
      renderComprasObraVazio('Nenhuma ordem de compra vinculada a esta obra foi localizada na planilha.');
      return;
    }

    const comprasValidas = resumo.compras.filter(compra => !compra.cancelada);
    const comprasCanceladas = resumo.compras.filter(compra => compra.cancelada);
    const fornecedores = Array.isArray(resumo.fornecedores) ? resumo.fornecedores.slice(0, 4) : [];
    const nfs = Array.isArray(resumo.notasFiscais) ? resumo.notasFiscais.slice(0, 4) : [];
    const comprasTabela = comprasValidas.slice(0, 8);

    const fornecedoresTxt = fornecedores.length ? fornecedores.map(escapeHtml).join(' / ') : '-';
    const nfsTxt = nfs.length ? nfs.map(escapeHtml).join(' / ') : '-';
    const ocultas = Math.max(comprasValidas.length - comprasTabela.length, 0);

    const linhas = comprasTabela.map(compra => `
      <tr>
        <td class="fw-bold">${escapeHtml(compra.pednum || '-')}</td>
        <td class="td-read-left">${escapeHtml(compra.fornecedor || '-')}</td>
        <td class="fw-bold">R$ ${formatMoneyBR(compra.valor || 0)}</td>
        <td>${escapeHtml(formatDateCompraDisplay(compra.data_entrega))}</td>
        <td>${escapeHtml(compra.nf || '-')}</td>
      </tr>
    `).join('');

    body.innerHTML = `
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
          <div class="border rounded-3 p-2 bg-light h-100">
            <div class="small text-muted fw-bold text-uppercase">Total OC</div>
            <div class="fw-black text-primary">R$ ${formatMoneyBR(resumo.valorTotal || 0)}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="border rounded-3 p-2 bg-light h-100">
            <div class="small text-muted fw-bold text-uppercase">OCs válidas</div>
            <div class="fw-black">${comprasValidas.length}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="border rounded-3 p-2 bg-light h-100">
            <div class="small text-muted fw-bold text-uppercase">Última entrega</div>
            <div class="fw-black">${escapeHtml(formatDateCompraDisplay(resumo.ultimaEntrega))}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="border rounded-3 p-2 bg-light h-100">
            <div class="small text-muted fw-bold text-uppercase">Canceladas</div>
            <div class="fw-black ${comprasCanceladas.length ? 'text-danger' : ''}">${comprasCanceladas.length}</div>
          </div>
        </div>
      </div>

      <div class="small text-muted fw-semibold mb-2">
        <strong>Fornecedores:</strong> ${fornecedoresTxt}
      </div>
      <div class="small text-muted fw-semibold mb-3">
        <strong>NFs:</strong> ${nfsTxt}
      </div>

      <div class="table-responsive border rounded-3">
        <table class="table table-sm mb-0 align-middle">
          <thead>
            <tr>
              <th>OC</th>
              <th>Fornecedor</th>
              <th>Valor</th>
              <th>Entrega</th>
              <th>NF</th>
            </tr>
          </thead>
          <tbody>
            ${linhas || `<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma OC válida localizada.</td></tr>`}
          </tbody>
        </table>
      </div>

      ${ocultas > 0 ? `<div class="small text-muted fw-semibold mt-2">+ ${ocultas} ordem(ns) de compra não exibida(s) nesta prévia.</div>` : ''}
    `;
  }

  function carregarComprasDaObraNoModal(row) {
    const body = ensureComprasObraSection();
    if (!body) return;

    body.innerHTML = `<div class="text-muted small fw-semibold"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Carregando compras apropriadas...</div>`;

    const obra = Array.isArray(row) ? row[COLS.OBRA] : document.getElementById('obra')?.value;
    if (!obra) {
      renderComprasObraVazio('Informe uma obra para consultar as compras apropriadas.');
      return;
    }

    if (!window.motorCompras || typeof window.motorCompras.getResumoObra !== 'function') {
      renderComprasObraErro('Motor de compras não carregado. A carteira principal continua funcionando normalmente.');
      return;
    }

    window.motorCompras.getResumoObra(obra)
      .then(resumo => renderComprasObraResumo(resumo))
      .catch(err => renderComprasObraErro(extrairMensagemErro(err)));
  }


  function editar(idx) {
    if (!dadosLocais[idx] || !Array.isArray(dadosLocais[idx].content)) { notify("Registro inválido para edição."); return; }
    const r = dadosLocais[idx].content; document.getElementById('formPrincipal').reset();

    document.getElementById('data_entrada_orig').value = r[COLS.DATA] || ""; 
    document.getElementById('obra').value = r[COLS.OBRA] || "";
    document.getElementById('cliente').value = r[COLS.CLIENTE] || ""; 
    
    const rawValor = r[COLS.VALOR];
    document.getElementById('valor').value = (rawValor !== "" && rawValor !== null) ? parseMoneyFlexible(rawValor).toFixed(2).replace('.00', '') : "";
    
    const rawCpmv = r[COLS.CPMV];
    document.getElementById('cpmv_obra_val').value = (rawCpmv !== "" && rawCpmv !== null) ? parseMoneyFlexible(rawCpmv).toFixed(2).replace('.00', '') : "0";
    
    document.getElementById('dias_prazo').value = r[COLS.DIAS_PRAZO] || ""; document.getElementById('analise').value = r[COLS.OBS] || "";

    document.getElementById('modalObraTitle').innerText = 'EDIÇÃO DE OBRA'; document.getElementById('btnFin').style.display = 'inline-block'; document.getElementById('btnGeral').style.display = 'inline-block';

    const det = safeJsonParse(r[COLS.DETALHES_JSON], {});

    ITENS.forEach((it, i) => {
      const val = String(r[COLS.ITEM_INICIO + i] || "").trim(); const id = getSafeId(it);
      limparCamposDetalhesItem(id);

      if (val === "OK") { setStatus(id, 'OK'); } 
      else if (val === "?") { setStatus(id, '?'); } 
      else if (val === "N/A" || val === "") { setStatus(id, 'N/A'); } 
      else if (isStatusDate(val)) {
        const dVal = document.getElementById(`${id}_date_val`); const dt = parseDataUniversal(val);
        if (dVal && dt) { const ano = dt.getFullYear(); const mes = String(dt.getMonth() + 1).padStart(2, '0'); const dia = String(dt.getDate()).padStart(2, '0'); dVal.value = `${ano}-${mes}-${dia}`; }
        setStatus(id, 'DATA');
      } else { setStatus(id, 'N/A'); }

      if (det[id] && typeof det[id] === "object") {
        if (document.getElementById(id + '_ped_val')) document.getElementById(id + '_ped_val').value = det[id].pedido || "";
        if (document.getElementById(id + '_cheg_val')) document.getElementById(id + '_cheg_val').value = det[id].chegada || "";
        
        if (document.getElementById(id + '_valor_val')) {
          const rawPreco = det[id].preco;
          document.getElementById(id + '_valor_val').value = (rawPreco !== "" && rawPreco !== undefined) ? parseMoneyFlexible(rawPreco).toFixed(2).replace('.00', '') : "";
        }
        
        if (document.getElementById(id + '_forn_val')) document.getElementById(id + '_forn_val').value = det[id].fornecedor || "";
        if (document.getElementById(id + '_oc_val')) document.getElementById(id + '_oc_val').value = det[id].oc || "";
        if (document.getElementById(id + '_desc_val')) document.getElementById(id + '_desc_val').value = det[id].descricao || "";
        if (document.getElementById(id + '_qdesc_val')) document.getElementById(id + '_qdesc_val').value = det[id].alerta_descricao || "";
      }
    });
    atualizarFaturamentoPrevistoFormulario(); recolherTodosItens(); modalUI.show();
  }


  function coletarItensFinanceirosFormulario() {
    const itensFinanceiros = [];

    ITENS.forEach(it => {
      if (it === "FATUR.") return;
      const id = getSafeId(it);
      const status = (document.getElementById(`${id}_status_hidden`)?.value || "").trim();
      if (!status || status === "N/A" || status === "?") return;
      const inputVal = document.getElementById(id + '_valor_val');
      const valor = inputVal ? parseMoneyFlexible(inputVal.value) : 0;
      itensFinanceiros.push({ item: it, status, valor });
    });

    return itensFinanceiros;
  }

  function getStatusCompraFinanceira(compra) {
    const partes = [];
    if (compra && compra.nf) partes.push(`NF ${compra.nf}`);
    if (compra && compra.data_entrega) partes.push(`Entrega ${formatDateCompraDisplay(compra.data_entrega)}`);
    return partes.join(" · ") || "OC";
  }

  async function obterFinanceiroComprasAtual() {
    const obraAtual = document.getElementById('obra')?.value || "";
    const cpmvFallback = parseMoneyFlexible(document.getElementById('cpmv_obra_val')?.value || 0);
    const itensFallback = coletarItensFinanceirosFormulario();
    const totalFallback = itensFallback.reduce((acc, item) => acc + parseMoneyFlexible(item.valor), 0);

    const fallback = {
      cpmv: cpmvFallback,
      totalCompras: totalFallback,
      itensFinanceiros: itensFallback,
      usandoCompras: false,
      cpmvInformado: cpmvFallback > 0,
      cpmvObservacao: "",
      aviso: ""
    };

    if (!obraAtual || !window.motorCompras || typeof window.motorCompras.getResumoObra !== "function") {
      return fallback;
    }

    try {
      const resumo = await window.motorCompras.getResumoObra(obraAtual);
      const comprasValidas = Array.isArray(resumo.compras)
        ? resumo.compras.filter(compra => !compra.cancelada)
        : [];

      const itensCompras = comprasValidas.map(compra => ({
        item: `OC ${compra.pednum || '-'} · ${compra.fornecedor || 'Fornecedor não informado'}`,
        status: getStatusCompraFinanceira(compra),
        valor: parseMoneyFlexible(compra.valor),
        compra
      }));

      const cpmvPlanejado = parseMoneyFlexible(resumo.cpmvPlanejado);
      const cpmvFinal = cpmvPlanejado > 0 ? cpmvPlanejado : cpmvFallback;
      const totalComprado = parseMoneyFlexible(resumo.valorTotal);

      return {
        cpmv: cpmvFinal,
        totalCompras: totalComprado,
        itensFinanceiros: itensCompras,
        usandoCompras: true,
        cpmvInformado: cpmvPlanejado > 0,
        cpmvObservacao: resumo.cpmvObservacao || "",
        aviso: cpmvPlanejado > 0
          ? ""
          : "CPMV planejado manual não informado na aba cpmv; usando valor local como fallback."
      };

    } catch (err) {
      const msg = extrairMensagemErro(err);
      return Object.assign({}, fallback, {
        aviso: `Não foi possível carregar OCs/CPMV da planilha. Usando dados locais como fallback. ${msg}`
      });
    }
  }



  function getObraAtualFinanceiro() {
    return String(document.getElementById('obra')?.value || '').trim();
  }

  function getCpmvPlanejadoFormValue() {
    const input = document.getElementById('inputCpmvPlanejadoFinanceiro');
    return input ? input.value : '';
  }

  function bindSalvarCpmvPlanejadoFinanceiro() {
    const btn = document.getElementById('btnSalvarCpmvPlanejadoFinanceiro');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const obra = getObraAtualFinanceiro();
      const valor = getCpmvPlanejadoFormValue();
      const observacao = document.getElementById('inputCpmvObservacaoFinanceiro')?.value || '';

      if (!obra) {
        notify("<i class='bi bi-exclamation-triangle me-2'></i> Informe a obra antes de salvar o CPMV planejado.");
        return;
      }

      const valorNum = parseMoneyFlexible(valor);
      if (!Number.isFinite(valorNum) || valorNum < 0) {
        notify("<i class='bi bi-exclamation-triangle me-2'></i> CPMV planejado inválido.");
        return;
      }

      if (!window.motorCompras || typeof window.motorCompras.salvarCpmvPlanejado !== 'function') {
        notify("<i class='bi bi-exclamation-triangle me-2'></i> Motor de compras não está disponível para salvar CPMV.");
        return;
      }

      const oldHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = "<span class='spinner-border spinner-border-sm me-2' role='status'></span>Salvando...";

      try {
        await window.motorCompras.salvarCpmvPlanejado(obra, valorNum, observacao, 'interface');
        notify("<i class='bi bi-check-circle me-2'></i> CPMV planejado salvo com sucesso.");
        await abrirDetalheFinanceiro();
      } catch (err) {
        notify(`<i class='bi bi-exclamation-triangle me-2'></i> ${escapeHtml(extrairMensagemErro(err))}`);
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    });
  }

  async function abrirDetalheFinanceiro() {
    const corpoResumo = document.getElementById('corpoResumoGeral');
    document.getElementById('tituloResumo').innerText = "Resumo Financeiro da Obra";
    if (corpoResumo) {
      corpoResumo.innerHTML = `
        <div class="text-center py-5 text-muted fw-bold">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
          Carregando OCs e CPMV planejado...
        </div>
      `;
    }
    modalResumoUI.show();

    const financeiro = await obterFinanceiroComprasAtual();
    const cpmv = parseMoneyFlexible(financeiro.cpmv);
    const itensFinanceiros = Array.isArray(financeiro.itensFinanceiros) ? financeiro.itensFinanceiros : [];
    const totalCompras = parseMoneyFlexible(financeiro.totalCompras);
    const totalUsadoCpmv = totalCompras;
    const percCpmv = cpmv > 0 ? ((totalUsadoCpmv / cpmv) * 100) : 0; const percCpmvLimitado = Math.min(percCpmv, 100);
    const saldoCpmvBruto = cpmv - totalUsadoCpmv; const saldoCpmv = Math.max(saldoCpmvBruto, 0);
    const percSaldoCpmv = cpmv > 0 ? Math.max(((saldoCpmvBruto > 0 ? saldoCpmvBruto : 0) / cpmv) * 100, 0) : 0;

    const totalItensCompra = itensFinanceiros.length;
    const itensOk = financeiro.usandoCompras ? totalItensCompra : itensFinanceiros.filter(reg => reg.status === "OK").length;
    const itensFalta = Math.max(totalItensCompra - itensOk, 0);
    const percItensOk = totalItensCompra > 0 ? (itensOk / totalItensCompra) * 100 : 0;
    const percItensFalta = totalItensCompra > 0 ? (itensFalta / totalItensCompra) * 100 : 0;

    let itemMaior = null;
    if (itensFinanceiros.length > 0) itemMaior = itensFinanceiros.reduce((a, b) => a.valor >= b.valor ? a : b);

    const saldoStatusClass = saldoCpmvBruto < 0 ? 'is-alert' : 'is-ok';
    const leituraCritica = itemMaior
      ? `maior peso atual em <strong>${itemMaior.item}</strong>`
      : 'nenhum item com custo lançado';
    const leituraPercentual = itemMaior && totalUsadoCpmv > 0
      ? `${((itemMaior.valor / totalUsadoCpmv) * 100).toFixed(1)}% da compra total`
      : '-';

    let html = `
      <div class="erp-page erp-finance-page">
        <section class="erp-command-panel">
          <div class="erp-command-copy">
            <span class="erp-command-kicker"><i class="bi bi-wallet2"></i> Painel financeiro da obra</span>
            <h2>Resumo de CPMV e compras</h2>
            <p>Visão operacional do custo planejado, uso registrado, saldo disponível e participação dos itens da obra.</p>
          </div>
          <div class="erp-command-side ${saldoStatusClass}">
            <span>Status do CPMV</span>
            <strong>${percCpmv.toFixed(1)}%</strong>
            <small>${formatMoneyBR(totalUsadoCpmv)} utilizado de ${formatMoneyBR(cpmv)}</small>
          </div>
        </section>

        ${financeiro.aviso ? `<div class="alert alert-warning py-2 px-3 small fw-semibold mb-3"><i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(financeiro.aviso)}</div>` : ''}

        <section class="erp-panel mb-3">
          <div class="erp-panel-heading compact">
            <div>
              <span>Planejamento manual</span>
              <h3>CPMV planejado da obra</h3>
            </div>
            <strong>${financeiro.cpmvInformado ? 'Informado' : 'Pendente'}</strong>
          </div>
          <div class="row g-2 align-items-end">
            <div class="col-12 col-md-4">
              <label class="sub-label" for="inputCpmvPlanejadoFinanceiro">CPMV planejado</label>
              <input type="text" id="inputCpmvPlanejadoFinanceiro" class="form-control form-control-sm shadow-none" value="${escapeHtml(cpmv > 0 ? String(cpmv.toFixed(2)).replace('.00', '') : '')}" placeholder="0,00">
            </div>
            <div class="col-12 col-md-6">
              <label class="sub-label" for="inputCpmvObservacaoFinanceiro">Observação</label>
              <input type="text" id="inputCpmvObservacaoFinanceiro" class="form-control form-control-sm shadow-none" value="${escapeHtml(financeiro.cpmvObservacao || '')}" placeholder="Ex.: CPMV previsto inicial">
            </div>
            <div class="col-12 col-md-2 d-grid">
              <button type="button" id="btnSalvarCpmvPlanejadoFinanceiro" class="btn btn-primary btn-sm fw-bold">
                <i class="bi bi-save me-1"></i>Salvar
              </button>
            </div>
          </div>
          <div class="helper-note mb-0">
            O valor salvo fica disponível para todos os usuários na aba <strong>cpmv</strong> da planilha.
          </div>
        </section>

        <section class="erp-kpi-strip">
          <article class="erp-kpi-card">
            <span class="erp-kpi-icon"><i class="bi bi-briefcase"></i></span>
            <div><small>CPMV planejado</small><strong>${formatMoneyBR(cpmv)}</strong></div>
          </article>
          <article class="erp-kpi-card">
            <span class="erp-kpi-icon"><i class="bi bi-graph-up-arrow"></i></span>
            <div><small>CPMV utilizado</small><strong>${formatMoneyBR(totalUsadoCpmv)}</strong></div>
          </article>
          <article class="erp-kpi-card ${saldoCpmvBruto < 0 ? 'is-alert' : 'is-ok'}">
            <span class="erp-kpi-icon"><i class="bi bi-pie-chart"></i></span>
            <div><small>Saldo disponível</small><strong>${formatMoneyBR(saldoCpmv)}</strong></div>
          </article>
          <article class="erp-kpi-card">
            <span class="erp-kpi-icon"><i class="bi bi-box-seam"></i></span>
            <div><small>Itens monitorados</small><strong>${totalItensCompra}</strong></div>
          </article>
        </section>

        <section class="erp-workspace-grid">
          <main class="erp-workspace-main">
            <article class="erp-panel erp-panel-progress">
              <div class="erp-panel-heading">
                <div>
                  <span>Controle de consumo</span>
                  <h3>Uso do custo planejado</h3>
                </div>
                <strong>${percCpmv.toFixed(1)}% utilizado</strong>
              </div>
              <div class="erp-progress-track"><div class="erp-progress-fill" style="width:${percCpmvLimitado}%"></div></div>
              <div class="erp-progress-legend"><span>0%</span><span>50%</span><span>100%</span></div>
            </article>

            <article class="erp-panel erp-panel-table">
              <div class="erp-panel-heading">
                <div>
                  <span>Detalhamento financeiro</span>
                  <h3>Itens registrados na obra</h3>
                </div>
                <strong>${totalItensCompra} itens</strong>
              </div>
              <div class="erp-table-wrap">
                <table class="erp-data-table">
                  <thead><tr><th>Item</th><th>Status</th><th>Valor</th><th>% / CPMV</th><th>% / Compra total</th></tr></thead>
                  <tbody>
    `;

    itensFinanceiros.forEach(reg => {
      const pTotal = cpmv > 0 ? ((reg.valor / cpmv) * 100).toFixed(1) : "0.0";
      const pCompra = totalUsadoCpmv > 0 ? ((reg.valor / totalUsadoCpmv) * 100).toFixed(1) : "0.0";
      const statusExibicao = isStatusDate(reg.status) ? formatDateDisplayBR(reg.status) : reg.status;
      const statusClass = reg.status === "OK" ? "is-ok" : (reg.status === "?" ? "is-alert" : (isStatusDate(reg.status) ? "is-date" : ""));
      html += `<tr><td class="erp-td-strong">${reg.item}</td><td><span class="erp-status-badge ${statusClass}">${statusExibicao}</span></td><td>${formatMoneyBR(reg.valor)}</td><td class="erp-percent">${pTotal}%</td><td class="erp-percent muted">${pCompra}%</td></tr>`;
    });

    if (itensFinanceiros.length === 0) html += `<tr><td colspan="5" class="erp-empty-row">Nenhum item financeiro registrado.</td></tr>`;

    html += `</tbody><tfoot><tr><td colspan="2">Total de compras</td><td>${formatMoneyBR(totalUsadoCpmv)}</td><td>${percCpmv.toFixed(1)}%</td><td>${itensFinanceiros.length > 0 ? '100%' : '0%'}</td></tr></tfoot>
                </table>
              </div>
            </article>
          </main>

          <aside class="erp-workspace-aside">
            <article class="erp-panel erp-side-panel">
              <div class="erp-panel-heading compact">
                <div><span>Análise CPMV</span><h3>${percCpmv.toFixed(1)}% usado</h3></div>
              </div>
              <div class="erp-info-list">
                <div><span>Uso registrado</span><strong>${formatMoneyBR(totalUsadoCpmv)}</strong></div>
                <div><span>Participação no CPMV</span><strong>${percCpmv.toFixed(1)}%</strong></div>
                <div><span>Saldo disponível</span><strong class="${saldoStatusClass}">${formatMoneyBR(saldoCpmvBruto)}</strong></div>
                <div><span>Saldo percentual</span><strong class="${saldoStatusClass}">${percSaldoCpmv.toFixed(1)}%</strong></div>
              </div>
            </article>

            <article class="erp-panel erp-side-panel">
              <div class="erp-panel-heading compact">
                <div><span>Itens de compra</span><h3>${totalItensCompra} itens</h3></div>
              </div>
              <div class="erp-info-list">
                <div><span>Base monitorada</span><strong>${totalItensCompra} itens</strong></div>
                <div><span>Concluídos</span><strong class="is-ok">${itensOk} · ${percItensOk.toFixed(1)}%</strong></div>
                <div><span>Pendentes</span><strong class="${itensFalta > 0 ? 'is-alert' : 'is-ok'}">${itensFalta} · ${percItensFalta.toFixed(1)}%</strong></div>
              </div>
            </article>

            <article class="erp-panel erp-reading-panel">
              <span class="erp-panel-mini-title">Leitura crítica</span>
              <p><i class="bi bi-activity"></i> <span>${leituraCritica}</span></p>
              <strong>${leituraPercentual}</strong>
            </article>
          </aside>
        </section>
      </div>`;

    document.getElementById('tituloResumo').innerText = "Resumo Financeiro da Obra";
    document.getElementById('corpoResumoGeral').innerHTML = html;
    bindSalvarCpmvPlanejadoFinanceiro();
    modalResumoUI.show();
  }
  function abrirResumoGeral() {
    const obra = document.getElementById('obra').value.trim();
    if (!obra) { notify("Informe a obra para consultar a base geral."); return; }

    const corpo = document.getElementById('corpoResumoGeral');
    corpo.innerHTML = `<div class="erp-page-loading"><div class="spinner-border text-primary" role="status"></div><p>Buscando dados na base GERAL...</p></div>`;
    modalResumoUI.show();

    callServer('getResumoGeralObra', [obra], res => {
      if (!res || !res.encontrado) {
        corpo.innerHTML = `<div class="erp-page-empty"><i class="bi bi-search"></i><strong>Obra não localizada na base.</strong><span>Confira o número informado e tente novamente.</span></div>`;
        return;
      }

      const lista = Array.isArray(res.dados) ? res.dados : [];
      const mapa = {};
      lista.forEach(d => {
        const chave = String(d.label || "").trim().toUpperCase();
        if (chave && mapa[chave] === undefined) mapa[chave] = d.valor || "-";
      });

      const obterCampo = (...labels) => {
        for (const label of labels) {
          const chave = String(label || "").trim().toUpperCase();
          const valor = mapa[chave];
          if (valor !== null && valor !== undefined && String(valor).trim() !== "" && String(valor).trim() !== "-") return valor;
        }
        return "-";
      };

      const isPreenchido = value => value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim() !== "-";
      const exibirCampo = value => escapeHtml(String(value ?? "-").trim() || "-");
      const exibirMoney = value => `R$ ${formatMoneyBR(value)}`;

      const obraBase = obterCampo("OBRA") !== "-" ? obterCampo("OBRA") : obra;
      const clienteBase = obterCampo("CLIENTE", "RAZÃO SOCIAL", "RAZAO SOCIAL");
      const itemBase = obterCampo("ITEM", "DESCRIÇÃO", "DESCRICAO");
      const categoriaBase = obterCampo("CATEGORIA", "CATEG.");
      const dataAbertura = obterCampo("DATA ABERTURA", "ABERTURA");
      const dataFirmada = obterCampo("DATA FIRMADA", "FIRMADA");
      const dataEnviada = obterCampo("DATA ENVIADA", "ENVIADA");
      const dataFaturamento = obterCampo("DATA FATURAMENTO", "FATURAMENTO", "DATA FATURAM");
      const ufBase = obterCampo("UF");
      const etapaBase = obterCampo("ETAPA", "STATUS", "SITUAÇÃO", "SITUACAO");
      const vendedorBase = obterCampo("VENDEDOR", "RESPONSÁVEL", "RESPONSAVEL");
      const segmentoBase = obterCampo("SEGMENTO");
      const complexidadeBase = obterCampo("COMPLEXIDADE");
      const complementoBase = obterCampo("COMPL.", "COMPLEMENTO", "COMPL");
      const nfBase = obterCampo("NF", "NFE", "NOTA FISCAL", "NOTA");
      const cpmvBase = obterCampo("CPMV");
      const prazoBase = obterCampo("PRAZO", "PZ", "PRAZ", "DIAS PRAZO");

      const total = parseMoneyFlexible(obterCampo("P. TOTAL", "VALOR TOTAL", "TOTAL", "VALOR"));
      const recebido = parseMoneyFlexible(obterCampo("RECEB.", "RECEBIDO", "VALOR RECEBIDO"));
      const carteira = parseMoneyFlexible(obterCampo("A RECEB", "A RECEBER", "EM CARTEIRA"));
      const percentualRecebido = total > 0 ? Math.min((recebido / total) * 100, 100) : 0;

      const statusOperacional = isPreenchido(dataFaturamento)
        ? "Faturada"
        : (isPreenchido(dataFirmada)
          ? "Firmada"
          : (isPreenchido(dataEnviada)
            ? "Enviada"
            : (isPreenchido(etapaBase) ? etapaBase : "Base geral")));

      const statusClasse = isPreenchido(dataFaturamento)
        ? "is-ok"
        : (isPreenchido(dataFirmada) ? "is-primary" : (isPreenchido(dataEnviada) ? "is-warning" : "is-neutral"));

      const camposPrincipais = [
        { icon: "bi-building", label: "Cliente", valor: clienteBase, destaque: true },
        { icon: "bi-folder2-open", label: "Obra", valor: obraBase },
        { icon: "bi-box-seam", label: "Item", valor: itemBase },
        { icon: "bi-tags", label: "Categoria", valor: categoriaBase },
        { icon: "bi-person-badge", label: "Responsável", valor: vendedorBase },
        { icon: "bi-geo-alt", label: "UF", valor: ufBase },
        { icon: "bi-diagram-3", label: "Segmento", valor: segmentoBase },
        { icon: "bi-sliders", label: "Complexidade", valor: complexidadeBase }
      ];

      const camposSituacao = [
        { icon: "bi-calendar-plus", label: "Abertura", valor: dataAbertura },
        { icon: "bi-send", label: "Enviada", valor: dataEnviada },
        { icon: "bi-pen", label: "Firmada", valor: dataFirmada },
        { icon: "bi-receipt-cutoff", label: "Faturamento", valor: dataFaturamento },
        { icon: "bi-flag", label: "Etapa", valor: etapaBase },
        { icon: "bi-receipt", label: "NF", valor: nfBase },
        { icon: "bi-calendar2-week", label: "Prazo", valor: prazoBase },
        { icon: "bi-grid", label: "Complemento", valor: complementoBase }
      ];

      const camposFinanceiros = [
        { label: "Valor total", valor: exibirMoney(total), classe: "is-main" },
        { label: "Recebido", valor: exibirMoney(recebido), classe: "is-ok" },
        { label: "A receber", valor: exibirMoney(carteira), classe: "" },
        { label: "CPMV", valor: exibirCampo(cpmvBase), classe: "" }
      ];

      const labelsUsados = new Set([
        "OBRA", "CLIENTE", "RAZÃO SOCIAL", "RAZAO SOCIAL", "ITEM", "DESCRIÇÃO", "DESCRICAO", "CATEGORIA", "CATEG.",
        "DATA ABERTURA", "ABERTURA", "DATA FIRMADA", "FIRMADA", "DATA ENVIADA", "ENVIADA", "DATA FATURAMENTO", "FATURAMENTO", "DATA FATURAM",
        "UF", "ETAPA", "STATUS", "SITUAÇÃO", "SITUACAO", "VENDEDOR", "RESPONSÁVEL", "RESPONSAVEL", "SEGMENTO", "COMPLEXIDADE",
        "COMPL.", "COMPLEMENTO", "COMPL", "NF", "NFE", "NOTA FISCAL", "NOTA", "CPMV", "PRAZO", "PZ", "PRAZ", "DIAS PRAZO",
        "P. TOTAL", "VALOR TOTAL", "TOTAL", "VALOR", "RECEB.", "RECEBIDO", "VALOR RECEBIDO", "A RECEB", "A RECEBER", "EM CARTEIRA"
      ]);

      const dadosAdicionais = lista
        .filter(d => !labelsUsados.has(String(d.label || "").trim().toUpperCase()))
        .filter(d => isPreenchido(d.valor));

      const montarCampo = d => `
        <article class="cbase-field-card ${d.destaque ? "is-wide" : ""} ${!isPreenchido(d.valor) ? "is-empty" : ""}">
          <span><i class="bi ${d.icon}"></i>${exibirCampo(d.label)}</span>
          <strong>${exibirCampo(d.valor)}</strong>
        </article>
      `;

      const montarLinhaTempo = () => camposSituacao.map(d => `
        <div class="cbase-timeline-item ${isPreenchido(d.valor) ? "is-active" : ""}">
          <span class="cbase-timeline-icon"><i class="bi ${d.icon}"></i></span>
          <div>
            <small>${exibirCampo(d.label)}</small>
            <strong>${exibirCampo(d.valor)}</strong>
          </div>
        </div>
      `).join('');

      const montarDadosAdicionais = () => {
        if (!dadosAdicionais.length) {
          return `<div class="cbase-empty-line"><i class="bi bi-info-circle"></i><span>Nenhum campo adicional preenchido foi retornado pela base.</span></div>`;
        }

        return `
          <div class="cbase-table-wrap">
            <table class="cbase-table">
              <tbody>
                ${dadosAdicionais.map(d => `
                  <tr>
                    <th>${exibirCampo(d.label)}</th>
                    <td>${exibirCampo(d.valor)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      };

      const html = `
        <div class="cbase-page">
          <section class="cbase-hero">
            <div class="cbase-hero-main">
              <span class="cbase-eyebrow"><i class="bi bi-database-check"></i> Consulta da base ERP</span>
              <h2>Obra ${exibirCampo(obraBase)}</h2>
              <p>${exibirCampo(clienteBase)}</p>
              <div class="cbase-chip-row">
                <span class="cbase-status ${statusClasse}"><i class="bi bi-circle-fill"></i>${exibirCampo(statusOperacional)}</span>
                <span><i class="bi bi-tags"></i>${exibirCampo(categoriaBase)}</span>
                <span><i class="bi bi-geo-alt"></i>${exibirCampo(ufBase)}</span>
              </div>
            </div>

            <aside class="cbase-hero-side">
              <span>Valor de referência</span>
              <strong>${exibirMoney(total)}</strong>
              <small>${percentualRecebido.toFixed(1)}% recebido pela base</small>
            </aside>
          </section>

          <section class="cbase-kpis">
            <article>
              <span><i class="bi bi-calendar-event"></i></span>
              <div><small>Abertura</small><strong>${exibirCampo(dataAbertura)}</strong></div>
            </article>
            <article>
              <span><i class="bi bi-person-badge"></i></span>
              <div><small>Responsável</small><strong>${exibirCampo(vendedorBase)}</strong></div>
            </article>
            <article>
              <span><i class="bi bi-receipt-cutoff"></i></span>
              <div><small>NF</small><strong>${exibirCampo(nfBase)}</strong></div>
            </article>
            <article>
              <span><i class="bi bi-hourglass-split"></i></span>
              <div><small>A receber</small><strong>${exibirMoney(carteira)}</strong></div>
            </article>
          </section>

          <section class="cbase-layout">
            <main class="cbase-main">
              <article class="cbase-section">
                <header>
                  <span>Dados da proposta</span>
                  <h3>Ficha principal da obra</h3>
                </header>
                <div class="cbase-field-grid">
                  ${camposPrincipais.map(montarCampo).join('')}
                </div>
              </article>

              <article class="cbase-section">
                <header>
                  <span>Situação e datas</span>
                  <h3>Acompanhamento do registro</h3>
                </header>
                <div class="cbase-field-grid">
                  ${camposSituacao.map(montarCampo).join('')}
                </div>
              </article>

              <article class="cbase-section">
                <header>
                  <span>Base ERP</span>
                  <h3>Campos adicionais disponíveis</h3>
                </header>
                ${montarDadosAdicionais()}
              </article>
            </main>

            <aside class="cbase-aside">
              <article class="cbase-section cbase-finance">
                <header>
                  <span>Resumo financeiro</span>
                  <h3>Leitura rápida</h3>
                </header>
                <div class="cbase-progress"><div style="width:${percentualRecebido.toFixed(1)}%"></div></div>
                <div class="cbase-finance-list">
                  ${camposFinanceiros.map(d => `
                    <div>
                      <span>${exibirCampo(d.label)}</span>
                      <strong class="${d.classe}">${d.valor}</strong>
                    </div>
                  `).join('')}
                </div>
              </article>

              <article class="cbase-section cbase-timeline">
                <header>
                  <span>Linha do tempo</span>
                  <h3>Eventos da obra</h3>
                </header>
                ${montarLinhaTempo()}
              </article>

              <article class="cbase-section cbase-note">
                <header>
                  <span>Observação</span>
                  <h3>Consulta segura</h3>
                </header>
                <p><i class="bi bi-shield-check"></i>Esta tela reorganiza os dados retornados pela base geral. Nenhuma regra financeira, cálculo ou consolidação foi alterada.</p>
              </article>
            </aside>
          </section>
        </div>`;

      document.getElementById('tituloResumo').innerText = `Resumo da Obra - ${obraBase}`;
      corpo.innerHTML = html;
    }, msg => {
      corpo.innerHTML = `<div class="erp-page-empty is-error"><i class="bi bi-exclamation-triangle"></i><strong>Erro na busca</strong><span>${msg}</span></div>`;
      notify("Erro na busca: " + msg);
    });
  }

  function deletar() { 
    const obra = document.getElementById('obra').value.trim();
    if (!obra) { notify("Nenhuma obra selecionada para exclusão."); return; }
    const confirmado = window.confirm(`Confirma a exclusão da obra ${obra}?\n\nEssa ação não poderá ser desfeita.`); if (!confirmado) return;
    callServer('excluirObra', [obra], res => { modalUI.hide(); carregar(); notify(res || "🗑️ Obra excluída."); }, msg => { notify("Erro ao excluir: " + msg); });
  }

  function buscarInfoObra() { 
    const obra = document.getElementById('obra').value.trim(); if (!obra) return;
    callServer('getDadosGeralSimplificado', [obra], res => {
      if (res) { document.getElementById('cliente').value = res.cliente || ""; document.getElementById('valor').value = res.valor || ""; document.getElementById('dias_prazo').value = res.prazo || ""; document.getElementById('data_entrada_orig').value = res.dataFirmada || ""; atualizarFaturamentoPrevistoFormulario(); }
    }, msg => { notify("Erro ao buscar dados da obra: " + msg); });
  }
  
  function toggleMenuExtracao(event) { if (event) event.stopPropagation(); const menu = document.getElementById('menuExtracao'); if (menu) menu.classList.toggle('show'); }
  function fecharMenuExtracao() { const menu = document.getElementById('menuExtracao'); if (menu) menu.classList.remove('show'); }
  document.addEventListener('click', event => { const wrap = document.querySelector('.export-menu-wrap'); if (wrap && !wrap.contains(event.target)) fecharMenuExtracao(); });

  function obterObrasAtivas() {
    const base = Array.isArray(dadosLocais) ? dadosLocais.slice(1) : [];
    return base.filter(d => statusLinhaCorrespondeFiltro(d.content[COLS.STATUS_PROPOSTA]));
  }

  function normalizarDataZeroHora(data) { if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null; const dt = new Date(data.getTime()); dt.setHours(0, 0, 0, 0); return dt; }
  function formatDateBRFromDate(data) { const dt = normalizarDataZeroHora(data); if (!dt) return ""; const dia = String(dt.getDate()).padStart(2, '0'); const mes = String(dt.getMonth() + 1).padStart(2, '0'); const ano = String(dt.getFullYear()).slice(-2); return `${dia}/${mes}/${ano}`; }

  function addDiasCorridos(data, dias) { const dt = normalizarDataZeroHora(data); if (!dt) return null; dt.setDate(dt.getDate() + (parseInt(dias, 10) || 0)); return dt; }
  function addDiasUteis(data, dias) { const dt = normalizarDataZeroHora(data); if (!dt) return null; let restantes = parseInt(dias, 10) || 0; while (restantes > 0) { dt.setDate(dt.getDate() + 1); const diaSemana = dt.getDay(); if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1; } return dt; }

  function obterDetalhesJsonRow(row) { const r = Array.isArray(row?.content) ? row.content : row; return safeJsonParse(r && r[COLS.DETALHES_JSON], {}); }

  function obterUltimaChegadaRow(row) {
    const detalhes = obterDetalhesJsonRow(row); let ultima = null;
    ITENS.forEach(item => {
      if (item === "FATUR.") return;
      const sid = getSafeId(item); const chegada = detalhes[sid] && detalhes[sid].chegada ? parseDataUniversal(detalhes[sid].chegada) : null;
      if (!chegada) return; const dt = normalizarDataZeroHora(chegada); if (!ultima || dt.getTime() > ultima.getTime()) ultima = dt;
    }); return ultima;
  }

  function calcularDataPrevistaRow(row) {
    const r = Array.isArray(row?.content) ? row.content : row; if (!r) return null;
    const dataFirmada = normalizarDataZeroHora(parseDataUniversal(r[COLS.DATA])); if (!dataFirmada) return null;
    const ultimaChegada = obterUltimaChegadaRow(r); if (ultimaChegada) return addDiasUteis(ultimaChegada, 5);
    return addDiasCorridos(dataFirmada, r[COLS.DIAS_PRAZO]);
  }

  function obterPrazoLimite(row) { return calcularDataPrevistaRow(row); }

  function coletarEventosData(row) {
    const r = Array.isArray(row?.content) ? row.content : row; const eventos = []; if (!r) return eventos;
    ITENS.forEach((item, idx) => {
      const valor = String(r[COLS.ITEM_INICIO + idx] || '').trim(); if (!isStatusDate(valor)) return;
      const dt = parseDataUniversal(valor); if (!dt) return;
      eventos.push({ item, texto: valor, obra: r[COLS.OBRA] || '', cliente: r[COLS.CLIENTE] || '', timestamp: dt.getTime() });
    });
    const prazoLimite = obterPrazoLimite(r);
    if (prazoLimite) { eventos.push({ item: 'PRAZO', texto: formatDateDisplayBR(formatDateToBRFromISO(prazoLimite.toISOString().slice(0,10))), obra: r[COLS.OBRA] || '', cliente: r[COLS.CLIENTE] || '', timestamp: prazoLimite.getTime() }); }
    return eventos;
  }

  function normalizarDataTexto(valor) { const txt = String(valor || '').trim(); if (!txt) return '-'; if (isStatusDate(txt)) return formatDateDisplayBR(txt); if (isIsoDate(txt)) return formatDateToBRFromISO(txt); return txt; }

  function gerarAnaliseGeral() {
    const obras = obterObrasAtivas();
    const totalCarteira = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.VALOR]), 0);
    const mediaCPMV = obras.length ? obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.CPMV]), 0) / obras.length : 0;

    const atrasos = obras.map(row => { return { row, status: calcularPorcentagem(row.content) }; }).filter(x => x.status.atraso).sort((a, b) => b.status.valor - a.status.valor);
    const compras = obras.map(row => { return { row, status: calcularStatusComprasVirtual(row.content) }; });
    const comprasPendentes = compras.filter(x => x.status.valor < 100);
    const comprasCriticas = comprasPendentes.filter(x => x.status.valor > 0 && x.status.valor < 60);

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximosEventos = obras.flatMap(coletarEventosData).filter(ev => ev.timestamp >= hoje.getTime()).sort((a,b)=>a.timestamp-b.timestamp).slice(0,4);

    const linhas = [];
    linhas.push(`📊 *Resumo geral da base filtrada*`); linhas.push(`🏗️ Obras ativas no filtro: ${obras.length}`); linhas.push(`💰 Total: R$ ${formatMoneyBR(totalCarteira)}`); linhas.push(`📉 CPMV médio: R$ ${formatMoneyBR(mediaCPMV)}`); linhas.push('');
    linhas.push(`⏱️ *Prazos*`);
    if (atrasos.length) { atrasos.slice(0,3).forEach(x => linhas.push(`• Obra ${x.row.content[COLS.OBRA]} (${x.row.content[COLS.CLIENTE]}): ${x.status.texto}`)); } else { linhas.push('• Nenhuma obra em atraso crítico no momento.'); } linhas.push('');
    linhas.push(`📦 *Compras e entregas*`); linhas.push(`• Obras com compras pendentes: ${comprasPendentes.length}`);
    if (comprasCriticas.length) { linhas.push(`• Compras mais críticas: ${comprasCriticas.slice(0,2).map(x => x.row.content[COLS.OBRA]).join(', ')}`); }
    if (proximosEventos.length) { linhas.push(`• Próximos vencimentos / entregas:`); proximosEventos.forEach(ev => linhas.push(`  - ${ev.obra} • ${ev.item}: ${normalizarDataTexto(ev.texto)}`)); } else { linhas.push(`• Não há vencimentos ou entregas futuras registradas.`); } linhas.push('');
    
    const leitura = atrasos.length ? `Prioridade do dia: atacar primeiro as obras ${atrasos.slice(0,2).map(x => x.row.content[COLS.OBRA]).join(' e ')} por risco de prazo.` : comprasCriticas.length ? `Prioridade do dia: regularizar compras das obras ${comprasCriticas.slice(0,2).map(x => x.row.content[COLS.OBRA]).join(' e ')}.` : `Cenário controlado: manter acompanhamento das compras e dos próximos vencimentos.`;
    linhas.push(`🧠 *Leitura geral*`); linhas.push(leitura); return linhas.join('\n');
  }

  function gerarAnalisePorObra(obraSolicitada) {
    const obra = String(obraSolicitada || '').trim(); if (!obra) return null;
    const row = obterObrasAtivas().find(item => String(item.content[COLS.OBRA] || '').trim() === obra); if (!row) return null;

    const r = row.content; const prazo = calcularPorcentagem(r); const compras = calcularStatusComprasVirtual(r);
    const eventos = coletarEventosData(r).filter(ev => ev.item !== 'PRAZO').sort((a,b)=>a.timestamp-b.timestamp).slice(0,4);

    const proximidadePrazo = obterPrazoLimite(r); let prazoTexto = prazo.texto;
    if (proximidadePrazo && !prazo.atraso) prazoTexto += ` • limite ${formatDateDisplayBR(formatDateToBRFromISO(proximidadePrazo.toISOString().slice(0,10)))}`;

    const linhas = [];
    linhas.push(`📍 *Resumo da obra ${r[COLS.OBRA]}*`); linhas.push(`👤 Cliente: ${r[COLS.CLIENTE] || '-'}`); linhas.push(`💰 Valor: R$ ${formatMoneyBR(r[COLS.VALOR])}`); linhas.push(`📉 CPMV: R$ ${formatMoneyBR(r[COLS.CPMV])}`); linhas.push(`⏱️ Prazo: ${prazoTexto}`); linhas.push(`📦 Status de compras: ${compras.texto}`); linhas.push('');
    linhas.push(`🔎 *Pontos de atenção*`);
    if (eventos.length) { eventos.forEach(ev => linhas.push(`• ${ev.item}: ${normalizarDataTexto(ev.texto)}`)); } else { linhas.push('• Sem datas de entrega registradas até o momento.'); }

    const obs = String(r[COLS.OBS] || '').trim(); if (obs) { linhas.push(''); linhas.push(`📝 Observações: ${obs}`); }
    linhas.push(''); linhas.push(`🧠 *Leitura da obra*`);
    if (prazo.atraso) { linhas.push(`A obra está em atraso e precisa de priorização imediata nas pendências de compra e faturamento.`); } else if (compras.valor < 100) { linhas.push(`A obra segue dentro do prazo, mas ainda depende de compras para manter o cronograma controlado.`); } else { linhas.push(`A obra está com compras concluídas e exige apenas acompanhamento das próximas datas e faturamento.`); }
    return linhas.join('\n');
  }

  let modalExtracaoUI = null; let contextoExtracaoAtual = null; let tipoExtracaoAtual = 'geral';

  function inicializarModalExtracao() {
    const el = document.getElementById('modalExtracaoRelatorio');
    if (el && !modalExtracaoUI && window.bootstrap?.Modal) {
      modalExtracaoUI = new bootstrap.Modal(el);
      el.addEventListener('shown.bs.modal', () => {
        const input = document.getElementById('inputObraExtracao');
        if (!input.classList.contains('d-none') && !document.getElementById('blocoObraExtracao').classList.contains('d-none')) { setTimeout(() => input.focus(), 80); }
      });
    }
  }

  function abrirModalExtracao(contexto) {
    fecharMenuExtracao();
    if (!obterObrasAtivas().length) { notify('Carregue as obras antes de extrair o relatório.'); return; }
    inicializarModalExtracao(); contextoExtracaoAtual = contexto; tipoExtracaoAtual = contexto === 'whatsapp-obra' ? 'obra' : 'geral';

    document.getElementById('tituloModalExtracao').textContent = contexto === 'pdf' ? 'Gerar relatório em PDF' : 'Preparar resumo para WhatsApp';
    document.getElementById('subtituloModalExtracao').textContent = contexto === 'pdf' ? 'Escolha o escopo e gere o arquivo.' : 'Escolha o escopo e monte a mensagem.';
    document.getElementById('btnExtracaoGeral').classList.toggle('d-none', contexto === 'whatsapp-obra');
    document.getElementById('blocoTipoExtracao').classList.toggle('d-none', contexto === 'whatsapp-obra');
    document.getElementById('btnConfirmarExtracao').textContent = contexto === 'pdf' ? 'Gerar PDF' : 'Preparar resumo';

    selecionarTipoExtracao(tipoExtracaoAtual, true);
    document.getElementById('inputObraExtracao').value = document.getElementById('obra')?.value?.trim() || ''; modalExtracaoUI?.show();
  }

  function selecionarTipoExtracao(tipo, silencioso) {
    tipoExtracaoAtual = tipo;
    const btnGeral = document.getElementById('btnExtracaoGeral'); const btnObra = document.getElementById('btnExtracaoObra'); const blocoObra = document.getElementById('blocoObraExtracao');
    if (btnGeral) btnGeral.classList.toggle('active', tipo === 'geral'); if (btnObra) btnObra.classList.toggle('active', tipo === 'obra'); if (blocoObra) blocoObra.classList.toggle('d-none', tipo !== 'obra');
    if (!silencioso && tipo === 'obra') { setTimeout(() => document.getElementById('inputObraExtracao')?.focus(), 80); }
  }

  function waEmoji(hex) { return String.fromCodePoint(hex); }
  function waDivider() { return '━━━━━━━━━━━━━━━━━━'; }

  function obterTextoWhatsAppGeral() {
    const obras = obterObrasAtivas();
    const totalCarteira = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.VALOR]), 0);
    const mediaCPMV = obras.length ? obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.CPMV]), 0) / obras.length : 0;

    const atrasos = obras.map(row => ({ row, status: calcularPorcentagem(row.content) })).filter(x => x.status.atraso).sort((a, b) => b.status.valor - a.status.valor);
    const emDia = Math.max(0, obras.length - atrasos.length);
    const comprasResumo = obras.map(row => ({ row, status: calcularStatusComprasVirtual(row.content) }));
    const comprasPendentes = comprasResumo.filter(x => x.status.valor < 100).sort((a, b) => a.status.valor - b.status.valor);
    const comprasConcluidas = comprasResumo.filter(x => x.status.valor >= 100).length;

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximosEventos = obras.flatMap(coletarEventosData).filter(ev => ev.timestamp >= hoje.getTime()).sort((a, b) => a.timestamp - b.timestamp).slice(0, 5);

    const prioridade = atrasos.slice(0, 2).map(x => x.row.content[COLS.OBRA]).filter(Boolean).join(' e ');
    const leituraRapida = atrasos.length ? `Prioridade imediata nas obras *${prioridade}* por risco de prazo e impacto operacional.` : (comprasPendentes.length ? 'Prazos sob controle, mas ainda existem compras pendentes que exigem acompanhamento próximo.' : 'Cenário estável, com foco nos próximos vencimentos e no faturamento.');

    const E = { chart: waEmoji(0x1F4CA), calendar: waEmoji(0x1F4C5), pin: waEmoji(0x1F4CC), building: waEmoji(0x1F3D7), money: waEmoji(0x1F4B0), trend: waEmoji(0x1F4C8), clock: waEmoji(0x23F1), alert: waEmoji(0x26A0), check: waEmoji(0x2705), cart: waEmoji(0x1F6D2), box: waEmoji(0x1F4E6), hourglass: waEmoji(0x231B), location: waEmoji(0x1F4CD), brain: waEmoji(0x1F9E0), robot: waEmoji(0x1F916) };

    const linhas = [];
    linhas.push(`${E.chart} *RESUMO DA BASE DE DADOS (${currentStatusFilter})*`); linhas.push(`${E.calendar} ${new Date().toLocaleDateString('pt-BR')}`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.pin} *VISÃO GERAL*`); linhas.push(`${E.building} Registros listados: *${obras.length}*`); linhas.push(`${E.money} Total dos registros: *R$ ${formatMoneyBR(totalCarteira)}*`); linhas.push(`${E.trend} CPMV médio: *R$ ${formatMoneyBR(mediaCPMV)}*`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.clock} *PRAZOS*`); linhas.push(`${E.alert} Obras em atraso: *${atrasos.length}*`); linhas.push(`${E.check} Obras no prazo: *${emDia}*`);
    if (atrasos.length) { atrasos.slice(0, 3).forEach(x => { linhas.push(`• Obra *${x.row.content[COLS.OBRA]}* (${x.row.content[COLS.CLIENTE] || '-'}) — *${x.status.texto}*`); }); } else { linhas.push('• Nenhuma obra em atraso crítico no momento.'); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.cart} *COMPRAS E ENTREGAS*`); linhas.push(`${E.check} Compras concluídas: *${comprasConcluidas}*`); linhas.push(`${E.hourglass} Compras pendentes: *${comprasPendentes.length}*`);
    if (comprasPendentes.length) { comprasPendentes.slice(0, 3).forEach(x => { linhas.push(`• Obra *${x.row.content[COLS.OBRA]}* — *${x.status.texto}*`); }); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.calendar} *PRÓXIMOS EVENTOS*`);
    if (proximosEventos.length) { proximosEventos.forEach(ev => { linhas.push(`${E.location} Obra *${ev.obra}* • ${ev.item}: *${normalizarDataTexto(ev.texto)}*`); }); } else { linhas.push('• Nenhuma data futura registrada no momento.'); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.brain} *LEITURA RÁPIDA*`); linhas.push(`• ${leituraRapida}`); linhas.push(''); linhas.push(`${E.robot} Relatório gerado automaticamente`);

    return linhas.join('\n');
  }

  function obterTextoWhatsAppObra(obraSolicitada) {
    const obra = String(obraSolicitada || '').trim(); if (!obra) return null;
    const row = obterObrasAtivas().find(item => String(item.content[COLS.OBRA] || '').trim() === obra); if (!row) return null;

    const r = row.content; const prazo = calcularPorcentagem(r); const compras = calcularStatusComprasVirtual(r);
    const eventos = coletarEventosData(r).filter(ev => ev.item !== 'PRAZO').sort((a, b) => a.timestamp - b.timestamp).slice(0, 5);

    const E = { chart: waEmoji(0x1F4CA), building: waEmoji(0x1F3D7), person: waEmoji(0x1F464), money: waEmoji(0x1F4B0), trendDown: waEmoji(0x1F4C9), clock: waEmoji(0x23F1), cart: waEmoji(0x1F6D2), calendar: waEmoji(0x1F4C5), note: waEmoji(0x1F4DD), brain: waEmoji(0x1F9E0), robot: waEmoji(0x1F916), target: waEmoji(0x1F3AF) };

    const statusLeitura = prazo.atraso ? 'Obra em atraso e com necessidade de ação imediata sobre compras, entregas e faturamento.' : (compras.valor < 100 ? 'Prazo sob controle, mas ainda há dependência de compras para manter o cronograma.' : 'Obra estável, exigindo acompanhamento das próximas datas e do faturamento.');

    const linhas = [];
    linhas.push(`${E.chart} *RESUMO DA OBRA*`); linhas.push(`${E.building} Obra: *${r[COLS.OBRA] || '-'}*`); linhas.push(`${E.person} Cliente: *${r[COLS.CLIENTE] || '-'}*`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.target} *RESUMO EXECUTIVO*`); linhas.push(`${E.money} Valor da obra: *R$ ${formatMoneyBR(r[COLS.VALOR])}*`); linhas.push(`${E.trendDown} CPMV: *R$ ${formatMoneyBR(r[COLS.CPMV])}*`); linhas.push(`${E.clock} Prazo: *${prazo.texto}*`); linhas.push(`${E.cart} Compras: *${compras.texto}*`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.calendar} *PRÓXIMOS PONTOS*`);
    if (eventos.length) { eventos.forEach(ev => linhas.push(`• ${ev.item}: *${normalizarDataTexto(ev.texto)}*`)); } else { linhas.push('• Sem datas de entrega registradas até o momento.'); }
    const obs = String(r[COLS.OBS] || '').trim(); if (obs) { linhas.push(''); linhas.push(waDivider()); linhas.push(''); linhas.push(`${E.note} *OBSERVAÇÃO*`); linhas.push(`• ${obs}`); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.brain} *LEITURA DA OBRA*`); linhas.push(`• ${statusLeitura}`); linhas.push(''); linhas.push(`${E.robot} Relatório gerado automaticamente`);

    return linhas.join('\n');
  }

  function abrirWhatsAppComTexto(texto) { try { navigator.clipboard?.writeText(texto).catch(() => {}); } catch (e) {} const url = `https://wa.me/?text=${encodeURIComponent(texto)}`; window.open(url, '_blank', 'noopener'); }

  function confirmarExtracaoRelatorio() {
    const tipo = tipoExtracaoAtual; const obra = document.getElementById('inputObraExtracao')?.value?.trim();
    if (tipo === 'obra' && !obra) { notify('Informe o número da obra para continuar.'); document.getElementById('inputObraExtracao')?.focus(); return; }
    modalExtracaoUI?.hide();

    if (contextoExtracaoAtual === 'pdf') { exportarRelatorioPDF(tipo, obra); return; }
    const texto = tipo === 'obra' ? obterTextoWhatsAppObra(obra) : obterTextoWhatsAppGeral();
    if (!texto) { notify('Obra não encontrada para gerar o resumo.'); return; }
    abrirWhatsAppComTexto(texto); notify(tipo === 'obra' ? 'Resumo da obra preparado para WhatsApp.' : 'Resumo geral preparado para WhatsApp.');
  }

  function gerarResumoWhatsApp(tipo) {
    fecharMenuExtracao();
    if (!obterObrasAtivas().length) { notify('Carregue as obras antes de extrair o relatório.'); return; }
    if (tipo === 'obra') { abrirModalExtracao('whatsapp-obra'); return; }
    const texto = obterTextoWhatsAppGeral(); abrirWhatsAppComTexto(texto); notify('Resumo geral preparado para WhatsApp.');
  }

  function calcularTotalComprasDaObra(rowContent) {
    const r = Array.isArray(rowContent) ? rowContent : []; const detalhes = safeJsonParse(r[COLS.DETALHES_JSON], {});
    return ITENS.reduce((acc, it) => { if (it === 'FATUR.') return acc; const id = getSafeId(it); const valor = parseMoneyFlexible(detalhes?.[id]?.preco || 0); return acc + valor; }, 0);
  }

  function obterMetricasGeraisRelatorio() {
    const obras = obterObrasAtivas();
    const totalCarteira = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.VALOR]), 0);
    const totalCPMV = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.CPMV]), 0);
    const mediaCPMV = obras.length ? totalCPMV / obras.length : 0;
    const atrasos = obras.map(row => ({ row, status: calcularPorcentagem(row.content) })).filter(x => x.status.atraso).sort((a,b)=>b.status.valor-a.status.valor);
    const comprasPendentes = obras.map(row => ({ row, status: calcularStatusComprasVirtual(row.content) })).filter(x => x.status.valor < 100);

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximosEventos = obras.flatMap(coletarEventosData).filter(ev => ev.timestamp >= hoje.getTime()).sort((a,b)=>a.timestamp-b.timestamp).slice(0,6);
    return { obras, totalCarteira, totalCPMV, mediaCPMV, atrasos, comprasPendentes, proximosEventos };
  }

  function obterMetricasObraRelatorio(obraSolicitada) {
    const row = obterObrasAtivas().find(item => String(item.content[COLS.OBRA] || '').trim() === String(obraSolicitada || '').trim()); if (!row) return null;
    const r = row.content; const prazo = calcularPorcentagem(r); const compras = calcularStatusComprasVirtual(r);
    const eventos = coletarEventosData(r).filter(ev => ev.item !== 'PRAZO').sort((a,b)=>a.timestamp-b.timestamp).slice(0,6);
    return { row, r, prazo, compras, eventos };
  }

  function abrirJanelaPDF(titulo, conteudoHtml) {
    try {
      const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo}</title><style>*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:28px;background:#f8fafc;color:#0f172a}.page{max-width:980px;margin:0 auto}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:22px}h1{font-size:26px;margin:0 0 6px;color:#0b3055}.subtitle{color:#64748b;font-size:13px}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.chip{padding:8px 12px;border:1px solid #dbe4ee;border-radius:999px;font-size:12px;color:#475569;background:#fff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.mini-card,.section{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,.05)}.mini-card{padding:16px 18px}.mini-label{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;font-weight:700}.mini-value{font-size:26px;font-weight:800;color:#0f172a;margin-top:6px}.section{padding:18px 20px;margin-top:16px}.section h2{font-size:16px;color:#16314f;margin:0 0 12px}.lead{white-space:pre-line;line-height:1.62;color:#334155}.bar-wrap{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:12px}.bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#16a34a)}.event-list{margin:0;padding-left:18px}.event-list li{margin:0 0 8px}.split{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}table{width:100%;border-collapse:collapse;font-size:14px}th{background:#0b3055;color:#fff;text-align:left;padding:10px 12px;font-size:12px}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#fff}.tag{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid #dbe4ee;font-weight:700;font-size:12px}.ok{color:#16a34a;border-color:#b7e4c7;background:#f3fbf6}.warn{color:#d97706;border-color:#f9d48b;background:#fffbeb}.bad{color:#dc2626;border-color:#fecaca;background:#fef2f2}.print-btn{border:0;background:#0b3055;color:#fff;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}@media print{body{padding:0;background:#fff}.print-only-hide{display:none}.section,.mini-card{box-shadow:none}}@media (max-width:900px){.grid,.split{grid-template-columns:1fr}}</style></head><body><div class="page"><div class="topbar"><div><h1>${titulo}</h1><div class="subtitle">Relatório da visualização atual do sistema.</div><div class="meta"><span class="chip">Gerado em ${new Date().toLocaleDateString('pt-BR')}</span><span class="chip">${currentStatusFilter}</span></div></div><button class="print-btn print-only-hide" onclick="window.print()">Salvar / Imprimir PDF</button></div>${conteudoHtml}</div></body></html>`;
      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); const janela = window.open(url, '_blank');
      if (!janela) { URL.revokeObjectURL(url); notify('Libere pop-ups para extrair o relatório em PDF.'); return; }
      janela.focus(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { console.error(e); notify('Não foi possível gerar o PDF. Tente novamente.'); }
  }

  function buildBar(value) { const pct = Math.max(0, Math.min(100, Number(value) || 0)); return `<div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>`; }

  function exportarRelatorioPDF(tipo, obra) {
    try {
      fecharMenuExtracao();
      if (!obterObrasAtivas().length) { notify('Carregue os dados antes de extrair o PDF.'); return; }
      if (!tipo) { abrirModalExtracao('pdf'); return; }

      if (tipo === 'obra') {
        const info = obterMetricasObraRelatorio(obra); if (!info) { notify('Obra não encontrada para exportar em PDF.'); return; }
        const { r, prazo, compras, eventos } = info; const comprasTotal = calcularTotalComprasDaObra(r);
        const usoCompras = Math.min(100, parseMoneyFlexible(r[COLS.CPMV]) > 0 ? (comprasTotal / parseMoneyFlexible(r[COLS.CPMV])) * 100 : 0);
        const html = `<div class="grid"><div class="mini-card"><div class="mini-label">Obra</div><div class="mini-value">${r[COLS.OBRA] || '-'}</div></div><div class="mini-card"><div class="mini-label">Cliente</div><div class="mini-value" style="font-size:22px">${r[COLS.CLIENTE] || '-'}</div></div><div class="mini-card"><div class="mini-label">Valor</div><div class="mini-value">R$ ${formatMoneyBR(r[COLS.VALOR])}</div></div></div><div class="split"><div class="section"><h2>Resumo executivo</h2><div class="lead">${obterTextoWhatsAppObra(r[COLS.OBRA]).replace(/\n/g,'<br>')}</div></div><div class="section"><h2>Painel rápido</h2><p><span class="tag ${prazo.atraso ? 'bad' : 'ok'}">${prazo.texto}</span></p><p><span class="tag ${compras.valor < 100 ? 'warn' : 'ok'}">${compras.texto}</span></p><p><strong>CPMV:</strong> R$ ${formatMoneyBR(r[COLS.CPMV])}</p><p><strong>Compras registradas:</strong> R$ ${formatMoneyBR(comprasTotal)}</p><p><strong>Uso do CPMV:</strong> ${usoCompras.toFixed(1)}%</p>${buildBar(usoCompras)}</div></div><div class="section"><h2>Próximos eventos da obra</h2><ul class="event-list">${eventos.length ? eventos.map(ev => `<li><strong>${ev.item}</strong> • ${normalizarDataTexto(ev.texto)}</li>`).join('') : '<li>Sem eventos futuros registrados.</li>'}</ul></div>`;
        abrirJanelaPDF(`Relatório da Obra ${r[COLS.OBRA]}`, html); return;
      }

      const info = obterMetricasGeraisRelatorio(); const totalCompras = info.obras.reduce((acc,row)=>acc + calcularTotalComprasDaObra(row.content),0);
      const usoMedio = info.totalCPMV > 0 ? (totalCompras / info.totalCPMV) * 100 : 0;
      const html = `<div class="grid"><div class="mini-card"><div class="mini-label">Obras Listadas</div><div class="mini-value">${info.obras.length}</div></div><div class="mini-card"><div class="mini-label">Total Exibido</div><div class="mini-value">R$ ${formatMoneyBR(info.totalCarteira)}</div></div><div class="mini-card"><div class="mini-label">CPMV médio</div><div class="mini-value">R$ ${formatMoneyBR(info.mediaCPMV)}</div></div></div><div class="split"><div class="section"><h2>Resumo executivo</h2><div class="lead">${obterTextoWhatsAppGeral().replace(/\n/g,'<br>')}</div></div><div class="section"><h2>Indicadores visuais</h2><p><strong>Uso médio do CPMV:</strong> ${usoMedio.toFixed(1)}%</p>${buildBar(usoMedio)}<p style="margin-top:14px"><strong>Obras com compras pendentes:</strong> ${info.comprasPendentes.length}</p><p><strong>Obras em atraso:</strong> ${info.atrasos.length}</p><p><strong>Próximos eventos:</strong> ${info.proximosEventos.length}</p></div></div><div class="section"><h2>Próximos vencimentos e entregas</h2><ul class="event-list">${info.proximosEventos.length ? info.proximosEventos.map(ev => `<li><strong>${ev.obra}</strong> • ${ev.item}: ${normalizarDataTexto(ev.texto)}</li>`).join('') : '<li>Sem entregas ou vencimentos futuros registrados.</li>'}</ul></div><div class="section"><h2>Obras que pedem atenção</h2><table><thead><tr><th>Obra</th><th>Cliente</th><th>Prazo</th><th>Compras</th></tr></thead><tbody>${(info.atrasos.length ? info.atrasos.slice(0,6) : info.obras.slice(0,6).map(row => ({row,status:calcularPorcentagem(row.content)}))).map(x => { const compras = calcularStatusComprasVirtual(x.row.content); return `<tr><td>${x.row.content[COLS.OBRA]}</td><td>${x.row.content[COLS.CLIENTE] || '-'}</td><td>${x.status.texto}</td><td>${compras.texto}</td></tr>`; }).join('')}</tbody></table></div>`;
      abrirJanelaPDF(`Relatório Geral (${currentStatusFilter})`, html);
    } catch (e) { console.error(e); notify('Não foi possível montar o relatório em PDF.'); }
  }

  let eventosResponsivosRegistrados = false;
  let blindagemModaisRegistrada = false;

  function sincronizarAnoFixoNaInterface() {
    const anoEfetivo = '26';
    const selectMobile = document.getElementById('anoFilterMobile');
    const selectPC = document.getElementById('anoFilterPC');

    if (selectMobile) selectMobile.value = anoEfetivo;
    if (selectPC) selectPC.value = anoEfetivo;
  }

  function atualizarShellResponsivo() {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    const vv = window.visualViewport;
    const altura = Math.round(vv ? vv.height : window.innerHeight);
    const largura = Math.round(vv ? vv.width : window.innerWidth);

    root.style.setProperty('--app-vh', `${altura}px`);
    root.style.setProperty('--app-vw', `${largura}px`);

    const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
    body.classList.toggle('device-mobile-shell', isMobile);
    body.classList.toggle('device-desktop-shell', !isMobile);
  }

  function ajustarRolagemDaTabela() {
    const viewport = document.querySelector('.table-viewport');
    if (!viewport) return;

    const viewportTop = viewport.getBoundingClientRect().top;
    const alturaJanela = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const margemInferior = document.body.classList.contains('device-mobile-shell') ? 24 : 36;
    const alturaDisponivel = Math.max(260, alturaJanela - viewportTop - margemInferior);

    viewport.style.maxHeight = `${alturaDisponivel}px`;
    viewport.classList.add('table-scroll-locked');
  }

  function recalibrarLayoutAplicacao() {
    atualizarShellResponsivo();
    sincronizarAnoFixoNaInterface();
    ajustarRolagemDaTabela();
  }

  function registrarEventosResponsivos() {
    if (eventosResponsivosRegistrados) return;
    eventosResponsivosRegistrados = true;

    const handler = () => {
      fecharMenuExtracao();
      recalibrarLayoutAplicacao();
    };

    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handler);
      window.visualViewport.addEventListener('scroll', handler);
    }
  }

  function configurarBlindagemViewportDosModais() {
    if (blindagemModaisRegistrada) return;
    blindagemModaisRegistrada = true;

    ['modalObra', 'modalCompraItem', 'modalPendenciaItem', 'modalResumoGeral', 'modalExtracaoRelatorio'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('shown.bs.modal', () => {
        document.body.classList.add('app-modal-open');
        setTimeout(recalibrarLayoutAplicacao, 30);
      });

      el.addEventListener('hidden.bs.modal', () => {
        if (!document.querySelector('.modal.show')) {
          document.body.classList.remove('app-modal-open');
        }
        setTimeout(recalibrarLayoutAplicacao, 30);
      });
    });
  }

  window.onload = () => {
    currentAnoFilter = '26';
    initModais();
    configurarBlindagemViewportDosModais();
    registrarEventosResponsivos();
    configurarCabecalhoData();
    carregarGrade();
    preencherOpcoesFiltroConcluidas();
    atualizarVisibilidadeFiltroConcluidas();
    sincronizarFiltroConcluidasNaInterface();
    sincronizarAnoFixoNaInterface();
    recalibrarLayoutAplicacao();
    carregar();
    setTimeout(recalibrarLayoutAplicacao, 120);
  };
