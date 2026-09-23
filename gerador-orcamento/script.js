// ==========================================
// LIGAÇÃO AO BANCO DE DADOS SUPABASE
// ==========================================
let supabaseCliente = null;
const supabaseUrl = 'https://wkjaafjnpzlvacvgszga.supabase.co';
const supabaseKey = 'sb_publishable_A9jDf4FTuaPwXMSu8UOHvg_au2AbHt1';

// Se o CDN do Supabase falhar, o gerador de orçamentos continua funcionando
// (nome diferente do global "supabase" que a biblioteca cria, para NÃO conflitar)
if (window.supabase) {
    supabaseCliente = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('Supabase JS não carregou. O gerador de orçamentos segue funcionando.');
}

// ==========================================
// CONTROLO DE SESSÃO E LOGIN (SUPABASE AUTH)
// ==========================================
function aplicarEstadoSessao(session) {
    const telaLogin = document.getElementById('tela-login');
    const conteudoApp = document.getElementById('conteudo-app');
    const emailLogado = document.getElementById('email-logado');

    if (session) {
        telaLogin.style.display = 'none';
        conteudoApp.style.display = 'block';
        emailLogado.innerText = `Logado como: ${session.user.email}`;
        renderizarTabela();
    } else {
        telaLogin.style.display = 'flex';
        conteudoApp.style.display = 'none';
        emailLogado.innerText = '';
    }
}

// Restaura a sessão ao abrir o site (e avisa se o servidor estiver inacessível)
document.addEventListener('DOMContentLoaded', async () => {
    if (supabaseCliente) {
        const { data } = await supabaseCliente.auth.getSession();
        aplicarEstadoSessao(data.session);
    } else {
        aplicarEstadoSessao(null);
        const avisoOffline = document.getElementById('aviso-offline');
        if (avisoOffline) {
            avisoOffline.style.display = 'block';
            avisoOffline.innerText = 'Conexão com o servidor indisponível. Recarregue a página.';
        }
    }
});

// Escuta as mudanças de estado (Login / Logout)
if (supabaseCliente) {
    supabaseCliente.auth.onAuthStateChange((event, session) => {
        aplicarEstadoSessao(session);
    });
}

// Função para Criar um Novo Empreendedor
async function criarConta() {
    if (!supabaseCliente) return alert('Serviço indisponível. Verifique sua conexão e recarregue.');
    const email = document.getElementById('auth-email').value.trim();
    const senha = document.getElementById('auth-senha').value;

    if (!email || !senha) return alert('Preencha e-mail e senha.');

    const { error } = await supabaseCliente.auth.signUp({ email, password: senha });

    if (error) {
        alert('Erro ao criar conta: ' + error.message);
    } else {
        alert('Conta criada com sucesso! Agora faça login.');
    }
}

// Função para Entrar no Sistema
async function fazerLogin() {
    if (!supabaseCliente) return alert('Serviço indisponível. Verifique sua conexão e recarregue.');
    const email = document.getElementById('auth-email').value.trim();
    const senha = document.getElementById('auth-senha').value;

    if (!email || !senha) return alert('Preencha e-mail e senha.');

    const { error } = await supabaseCliente.auth.signInWithPassword({ email, password: senha });

    if (error) {
        alert('Credenciais incorretas ou erro de conexão.');
    }
}

// Função para Sair do Sistema
async function fazerLogout() {
    if (!supabaseCliente) return;
    await supabaseCliente.auth.signOut();
}

// ==========================================
// SISTEMA DE BANCO DE DADOS NA NUVEM (SUPABASE)
// ==========================================

// Função para Salvar um Novo Orçamento na Nuvem
async function salvarOrcamento() {
    if (!supabaseCliente) return alert('Serviço indisponível. Verifique sua conexão.');

    const btnSalvar = document.querySelector('.btn-salvar');
    const textoOriginal = btnSalvar ? btnSalvar.innerText : '';
    if (btnSalvar) btnSalvar.innerText = 'Salvando na nuvem...';

    // Restaura o texto do botão mesmo em caso de erro
    function restaurarBotao() {
        if (btnSalvar) btnSalvar.innerText = textoOriginal;
    }

    try {
        // 1. Verifica quem é o usuário logado
        const { data: { user } } = await supabaseCliente.auth.getUser();
        if (!user) return restaurarBotao(), alert("Você precisa estar logado para salvar na nuvem.");

        // 2. Puxa os dados digitados na tela
        const cliente = document.getElementById('cliente').value;
        const servico = document.getElementById('servico').value;
        const pecas = parseFloat(document.getElementById('pecas').value) || 0;
        const maoDeObra = parseFloat(document.getElementById('mao-de-obra').value) || 0;
        const total = pecas + maoDeObra;

        if (!cliente) return restaurarBotao(), alert("Por favor, preencha o nome do cliente antes de salvar.");

        // 3. Verifica se o usuário já tem uma empresa cadastrada. Se não, cria uma genérica.
        let empresaId;
        const { data: empresas } = await supabaseCliente.from('empresas').select('id').eq('user_id', user.id);

        if (empresas && empresas.length > 0) {
            empresaId = empresas[0].id;
        } else {
            const { data: novaEmpresa } = await supabaseCliente.from('empresas').insert([{ nome: 'Minha Empresa', user_id: user.id }]).select();
            empresaId = novaEmpresa[0].id;
        }

        // 4. Envia o orçamento para a tabela no Supabase
        const { error } = await supabaseCliente.from('orcamentos').insert([{
            empresa_id: empresaId,
            cliente: cliente,
            servico: servico || null,
            valor_pecas: pecas,
            valor_maodeobra: maoDeObra,
            valor_total: total,
            status: 'Pendente',
            data_criacao: new Date().toISOString()
        }]);

        if (error) throw new Error(error.message);

        restaurarBotao();
        alert("Orçamento salvo com sucesso na nuvem! Estará disponível em qualquer aparelho.");
        renderizarTabela();

    } catch (erro) {
        restaurarBotao();
        console.error("Erro do Supabase:", erro);
        alert("Erro ao salvar orçamento. Verifique sua conexão.");
    }
}

// Função para desenhar a Tabela puxando os dados da Nuvem
async function renderizarTabela() {
    const tbody = document.getElementById('tabela-historico');
    if (!tbody) return;

    if (!supabaseCliente) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Serviço indisponível.</td></tr>';
        return;
    }

    // Mostra mensagem de carregamento enquanto busca os dados
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Buscando orçamentos na nuvem...</td></tr>';

    try {
        // Faz o SELECT no banco de dados ordenando do mais recente para o mais antigo
        const { data: orcamentos, error } = await supabaseCliente
            .from('orcamentos')
            .select('*')
            .order('data_criacao', { ascending: false });

        if (error) throw new Error(error.message);

        if (!orcamentos || orcamentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum orçamento salvo na sua conta ainda.</td></tr>';
            return;
        }

        tbody.innerHTML = ''; // Limpa a tabela para colocar os dados reais

        orcamentos.forEach(orc => {
            const formatoMoeda = { style: 'currency', currency: 'BRL' };
            const valorFormatado = parseFloat(orc.valor_total).toLocaleString('pt-BR', formatoMoeda);

            // Formata a data que vem do banco (Ex: 2026-09-23T...) para DD/MM/AAAA
            let dataFormatada = '—';
            if (orc.data_criacao) {
                const d = new Date(orc.data_criacao);
                if (!isNaN(d.getTime())) dataFormatada = d.toLocaleDateString('pt-BR');
            }

            let corStatus = '#eab308'; // Pendente
            if (orc.status === 'Aprovado') corStatus = '#10b981';
            if (orc.status === 'Recusado') corStatus = '#ef4444';

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td style="padding: 12px; color: #64748b;">${dataFormatada}</td>
                <td style="padding: 12px; font-weight: bold; color: #0f172a;">${orc.cliente}</td>
                <td style="padding: 12px; color: #2563eb; font-weight: bold;">${valorFormatado}</td>
                <td style="padding: 12px;">
                    <select onchange="mudarStatus('${orc.id}', this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid ${corStatus}; color: ${corStatus}; font-weight: bold; outline: none; cursor: pointer;">
                        <option value="Pendente" ${orc.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Em Negociação" ${orc.status === 'Em Negociação' ? 'selected' : ''}>Em Negociação</option>
                        <option value="Aprovado" ${orc.status === 'Aprovado' ? 'selected' : ''}>Aprovado!</option>
                        <option value="Recusado" ${orc.status === 'Recusado' ? 'selected' : ''}>Recusado</option>
                    </select>
                </td>
                <td style="padding: 12px;">
                    <button onclick="excluirOrcamento('${orc.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">Excluir</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    } catch (erro) {
        console.error("Erro ao carregar orçamentos:", erro);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: red;">Erro ao carregar do banco de dados.</td></tr>';
    }
}

// Função para atualizar o Status (Aprovado/Recusado) diretamente na Nuvem
async function mudarStatus(idDoOrcamento, novoStatus) {
    if (!supabaseCliente) return alert("Serviço indisponível.");

    const { error } = await supabaseCliente
        .from('orcamentos')
        .update({ status: novoStatus })
        .eq('id', idDoOrcamento);

    if (error) {
        alert("Erro ao atualizar status.");
    } else {
        renderizarTabela(); // Recarrega a tabela para atualizar as cores
    }
}

// Função para Excluir o Orçamento da Nuvem
async function excluirOrcamento(idDoOrcamento) {
    if (!supabaseCliente) return alert("Serviço indisponível.");

    // Confirmação para evitar exclusões acidentais
    const confirmacao = confirm("Tem a certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.");
    if (!confirmacao) return;

    const { error } = await supabaseCliente
        .from('orcamentos')
        .delete()
        .eq('id', idDoOrcamento);

    if (error) {
        alert("Erro ao excluir o orçamento.");
        console.error(error);
    } else {
        renderizarTabela(); // Recarrega a tabela para a linha sumir
    }
}

// Função para atualizar os dados da empresa na folha e salvar na memória
function atualizarEmpresa() {
    const empresa = document.getElementById('minha-empresa').value || 'Minha Empresa';
    const cnpj = document.getElementById('meu-cnpj').value || '---';
    const telefone = document.getElementById('meu-telefone').value || '---';

    // Atualiza a folha A4
    document.getElementById('out-minha-empresa').innerText = empresa;
    document.getElementById('out-meu-cnpj').innerText = `CNPJ/CPF: ${cnpj}`;
    document.getElementById('out-meu-telefone').innerText = `Tel: ${telefone}`;

    // Salva automaticamente no navegador do usuário
    localStorage.setItem('dadosMinhaEmpresa', JSON.stringify({
        empresa,
        cnpj,
        telefone
    }));
}

// Assim que a página carrega, insere a data atual automaticamente no documento
document.addEventListener("DOMContentLoaded", () => {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    document.getElementById('data-atual').innerText = `Data: ${dataAtual}`;

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('hora-atual').innerText = `Hora: ${horaAtual}`;

    // 1. Carrega a logo salva (se existir)
    const logoGuardado = localStorage.getItem('meuLogoOrcamento');
    if (logoGuardado) {
        document.getElementById('img-logo-preview').src = logoGuardado;
        document.getElementById('img-logo-preview').style.display = 'block';
    }

    // 2. Carrega os dados da empresa salvos (se existirem)
    const dadosSalvos = localStorage.getItem('dadosMinhaEmpresa');
    if (dadosSalvos) {
        const empresaObj = JSON.parse(dadosSalvos);

        // Preenche os campos do formulário
        document.getElementById('minha-empresa').value = empresaObj.empresa !== 'Minha Empresa' ? empresaObj.empresa : '';
        document.getElementById('meu-cnpj').value = empresaObj.cnpj !== '---' ? empresaObj.cnpj : '';
        document.getElementById('meu-telefone').value = empresaObj.telefone !== '---' ? empresaObj.telefone : '';

        // Atualiza o preview A4
        atualizarEmpresa();
    }
});

// Função para carregar a imagem, mostrá-la no PDF e guardá-la no navegador
function carregarLogo(event) {
    const ficheiro = event.target.files[0];
    
    if (ficheiro) {
        const leitor = new FileReader();
        
        leitor.onload = function(e) {
            const resultadoBase64 = e.target.result;
            
            // Troca o texto pela imagem carregada
            document.getElementById('img-logo-preview').src = resultadoBase64;
            document.getElementById('img-logo-preview').style.display = 'block';
            
            // Guarda a imagem no localStorage para não se perder ao atualizar a página
            localStorage.setItem('meuLogoOrcamento', resultadoBase64);
        };
        
        // Inicia a leitura do ficheiro
        leitor.readAsDataURL(ficheiro);
    }
}

// Função que atualiza o documento em tempo real conforme o usuário digita
function atualizarPreview() {
    // 1. Captura os valores dos inputs (ou deixa vazio se não tiver nada)
    const cliente = document.getElementById('cliente').value || '---';
    const servico = document.getElementById('servico').value || '---';

    // Captura o nome do material digitado. Se estiver vazio, usa o texto padrão.
    const nomeMaterial = document.getElementById('busca-material').value || 'Materiais / Insumos';

    // Converte os valores para números (se estiver vazio, vira 0)
    const pecas = parseFloat(document.getElementById('pecas').value) || 0;
    const maoDeObra = parseFloat(document.getElementById('mao-de-obra').value) || 0;
    const validade = document.getElementById('validade').value || '15';

    // 2. Calcula o Total
    const total = pecas + maoDeObra;

    // 3. Atualiza os textos na folha A4 (Preview)
    document.getElementById('out-cliente').innerText = cliente;
    document.getElementById('out-servico').innerText = servico;
    document.getElementById('out-validade').innerText = validade;

    // Envia o nome do material para a linha da tabela na folha A4
    document.getElementById('out-nome-material').innerText = nomeMaterial;

    // 4. Formata os números para o padrão Moeda Real (R$ 0,00)
    const formatoMoeda = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    
    document.getElementById('out-pecas').innerText = pecas.toLocaleString('pt-BR', formatoMoeda);
    document.getElementById('out-mao-de-obra').innerText = maoDeObra.toLocaleString('pt-BR', formatoMoeda);
    document.getElementById('out-total').innerText = total.toLocaleString('pt-BR', formatoMoeda);
}

const GEMINI_API_KEY = 'AQ.Ab8RN6KQdhCTNciBmk4Wm8ICEiKQ0YtvnBIIkzcs5xI-c4U9Qw';

// Variável para controlar o tempo de espera (Debounce)
let timeoutBusca = null;

async function buscarMaterialAPI() {
    const termo = document.getElementById('busca-material').value;
    const lista = document.getElementById('lista-resultados');

    // Só inicia a lógica se houver pelo menos 3 caracteres
    if (termo.length < 3) {
        lista.style.display = 'none';
        return;
    }

    // Mostra um feedback visual enquanto o usuário digita/espera
    lista.innerHTML = '<div style="padding: 10px; font-size: 14px; color: #64748b;">Consultando Inteligência Artificial...</div>';
    lista.style.display = 'block';

    // Limpa o cronômetro anterior se o usuário continuar digitando
    clearTimeout(timeoutBusca);

    // Configura o sistema para esperar 1 segundo (1000ms) após a última tecla
    timeoutBusca = setTimeout(async () => {
        // Endpoint do Gemini 3.5 Flash-Lite (rápido e otimizado)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
        
        // O Prompt: Damos uma ordem estrita para a IA retornar apenas dados limpos
        const prompt = `O usuário de um sistema de orçamentos digitou "${termo}" no campo de busca de materiais. Retorne exatamente 5 sugestões reais e específicas de materiais, peças ou insumos que correspondam a essa busca. Retorne APENAS os nomes separados por vírgula, sem introdução, sem pontos finais e sem formatação markdown.`;

        try {
            const resposta = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            
            const dados = await resposta.json();

            // Se a API retornar erro (chave inválida, limite, modelo inexistente...)
            if (!resposta.ok) {
                const msg = dados.error && dados.error.message ? dados.error.message : `Erro HTTP ${resposta.status}`;
                throw new Error(msg);
            }

            // Extrai o texto gerado pela IA
            const textoIA = dados.candidates[0].content.parts[0].text;
            
            // Transforma o texto (Ex: "Pedra A, Pedra B") em um Array
            const produtos = textoIA.split(',').map(item => item.trim());
            
            // Limpa a mensagem de "Consultando..."
            lista.innerHTML = '';
            
            produtos.forEach(produto => {
                if(!produto) return;
                
                const item = document.createElement('div');
                item.innerText = produto;
                item.style.padding = '10px';
                item.style.borderBottom = '1px solid #f1f5f9';
                item.style.cursor = 'pointer';
                item.style.fontSize = '14px';

                item.onmouseover = () => item.style.backgroundColor = '#eff6ff';
                item.onmouseout = () => item.style.backgroundColor = 'white';

                // Ao clicar na sugestão da IA, preenche o input e atualiza o PDF
                item.onclick = () => {
                    document.getElementById('busca-material').value = produto;
                    lista.style.display = 'none';
                    atualizarPreview();
                };

                lista.appendChild(item);
            });
        } catch (erro) {
            lista.innerHTML = '<div style="padding: 10px; font-size: 14px; color: #ef4444;">Erro ao consultar IA. Digite manualmente.</div>';
            console.error("Erro na API do Gemini:", erro);
        }
    }, 1000); 
}

// Lógica para fechar a lista se o usuário clicar fora dela
document.addEventListener('click', function(event) {
    const lista = document.getElementById('lista-resultados');
    const input = document.getElementById('busca-material');
    if (event.target !== input && !lista.contains(event.target)) {
        lista.style.display = 'none';
    }
});

// Função para gerar e baixar o PDF
function gerarPDF() {
    // Seleciona a div exata que será transformada em PDF
    const elemento = document.getElementById('documento-pdf');

    // No celular, remove a redução visual para o PDF sair em tamanho A4 cheio
    const emTelaPequena = window.matchMedia('(max-width: 768px)').matches;
    if (emTelaPequena) {
        elemento.style.transform = 'none';
    }

    // Corrige o "espaço em branco no topo": rola a página para o início antes de capturar
    window.scrollTo(0, 0);
    
    // Pega o nome do cliente para usar no nome do arquivo baixado
    let nomeCliente = document.getElementById('cliente').value;
    if(nomeCliente === "") nomeCliente = "Cliente";

    // Configurações do PDF (Qualidade, formato A4, escala)
    const opcoes = {
        margin:       0,
        filename:     `Orcamento_${nomeCliente}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, scrollY: 0 }, // scrollY: 0 evita conteúdo deslocado ao capturar
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Aciona a biblioteca html2pdf e restaura a redução visual no celular ao final
    html2pdf().set(opcoes).from(elemento).save().then(() => {
        if (emTelaPequena) {
            elemento.style.transform = '';
        }
    });
}

// ==========================================
// TESTE DE DIAGNÓSTICO DO SISTEMA (CRUD)
// Executar no console do navegador: testarSistema()
// ==========================================
async function testarSistema() {
    console.clear();
    console.log('Iniciando Teste Geral do Sistema...');

    try {
        // 1. Verifica Autenticação
        const { data: { user }, error: authError } = await supabaseCliente.auth.getUser();
        if (authError || !user) {
            throw new Error('Usuário não está logado. Faça o login na tela inicial primeiro.');
        }
        console.log('1. Autenticação OK. Conectado como:', user.email);

        // 2. Busca a Empresa do Usuário
        const { data: empresas, error: empError } = await supabaseCliente.from('empresas').select('*').eq('user_id', user.id);
        if (empError) throw empError;

        let empresaId;
        if (empresas && empresas.length > 0) {
            empresaId = empresas[0].id;
            console.log('2. Empresa encontrada:', empresas[0].nome);
        } else {
            console.log('Nenhuma empresa encontrada. O sistema criará uma ao salvar o primeiro orçamento.');
            return alert('Teste parcial concluído. Para o teste completo, salve um orçamento manualmente primeiro para gerar sua Empresa.');
        }

        // 3. Testa Inserção (Create)
        console.log('3. Inserindo orçamento de teste na nuvem...');
        const { data: insertData, error: insertError } = await supabaseCliente.from('orcamentos').insert([{
            empresa_id: empresaId,
            cliente: 'Cliente Robô (Teste Automático)',
            servico: 'Teste de Carga e Integração',
            valor_pecas: 500,
            valor_maodeobra: 300,
            valor_total: 800,
            status: 'Pendente',
            data_criacao: new Date().toISOString()
        }]).select();

        if (insertError) throw insertError;
        const orcamentoId = insertData[0].id;
        console.log('3. Orçamento criado. ID:', orcamentoId);

        // 4. Testa Leitura (Read)
        console.log('4. Lendo o banco de dados...');
        const { data: readData, error: readError } = await supabaseCliente.from('orcamentos').select('*').eq('id', orcamentoId);
        if (readError || !readData || readData.length === 0) throw readError || new Error('Orçamento não encontrado após salvar.');
        console.log('4. Leitura confirmada. Valor resgatado: R$', readData[0].valor_total);

        // 5. Testa Atualização (Update)
        console.log('5. Simulando negociação (Mudando status para Aprovado)...');
        const { error: updateError } = await supabaseCliente.from('orcamentos').update({ status: 'Aprovado' }).eq('id', orcamentoId);
        if (updateError) throw updateError;
        console.log('5. Status atualizado com sucesso!');

        // 6. Testa Exclusão (Delete) - Limpeza
        console.log('6. Apagando rastro do teste no banco...');
        const { error: deleteError } = await supabaseCliente.from('orcamentos').delete().eq('id', orcamentoId);
        if (deleteError) throw deleteError;
        console.log('6. Limpeza do banco de dados concluída!');

        console.log('TESTE FINALIZADO COM SUCESSO! A comunicação com o Supabase está segura e funcional.');
        alert('Todos os testes do banco de dados passaram! Verifique o console (F12) para ver o relatório completo.');

    } catch (erro) {
        console.error('ERRO NO TESTE:', erro);
        alert('Falha no teste: ' + erro.message);
    }
}