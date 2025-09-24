// IncidentResolutionPanel Component - Phase 7 Implementation
// This component should be added to the main HTML file before the ViewModal component

const IncidentResolutionPanel = ({ incident, onResolve, isVisible = false }) => {
    const [similarIncidents, setSimilarIncidents] = useState([]);
    const [kbArticles, setKbArticles] = useState([]);
    const [aiRecommendations, setAiRecommendations] = useState(null);
    const [confidenceScore, setConfidenceScore] = useState(0);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [manualResolution, setManualResolution] = useState('');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [showManualOverride, setShowManualOverride] = useState(false);

    if (!isVisible || !incident) return null;

    // Simular busca de incidentes similares
    useEffect(() => {
        const mockSimilarIncidents = [
            {
                id: 101,
                title: 'Erro similar CICS - Região PROD02',
                status: 'Resolvido',
                similarity: 94,
                resolution: 'Ajuste de parâmetros EDSALIM e DSALIM, reinício da região',
                resolutionTime: '2.5 horas',
                category: incident.category
            },
            {
                id: 89,
                title: 'Problema memória região CICS',
                status: 'Resolvido',
                similarity: 87,
                resolution: 'Restart com novos parâmetros de memória',
                resolutionTime: '1.8 horas',
                category: incident.category
            },
            {
                id: 76,
                title: 'CICS timeout frequente',
                status: 'Resolvido',
                similarity: 81,
                resolution: 'Otimização de queries e ajuste timeout',
                resolutionTime: '3.2 horas',
                category: incident.category
            },
            {
                id: 65,
                title: 'Configuração CICS incorreta',
                status: 'Resolvido',
                similarity: 78,
                resolution: 'Correção de parâmetros CICS e PTF aplicada',
                resolutionTime: '4.1 horas',
                category: incident.category
            }
        ];
        setSimilarIncidents(mockSimilarIncidents);
    }, [incident]);

    // Simular busca de artigos da KB
    useEffect(() => {
        const mockKBArticles = [
            {
                id: 'KB001',
                title: 'Troubleshooting CICS Memory Issues',
                summary: 'Guia completo para diagnóstico e resolução de problemas de memória CICS',
                relevance: 92,
                category: 'CICS',
                url: '#kb001'
            },
            {
                id: 'KB045',
                title: 'CICS Region Parameters Best Practices',
                summary: 'Melhores práticas para configuração de parâmetros de região CICS',
                relevance: 88,
                category: 'CICS',
                url: '#kb045'
            },
            {
                id: 'KB112',
                title: 'EDSALIM and DSALIM Configuration Guide',
                summary: 'Guia detalhado para configuração de parâmetros de memória CICS',
                relevance: 85,
                category: 'CICS',
                url: '#kb112'
            }
        ];
        setKbArticles(mockKBArticles);
    }, [incident]);

    // Gerar recomendações de IA
    const generateAIRecommendations = async () => {
        setIsLoadingAI(true);

        // Simular chamada de API de IA
        setTimeout(() => {
            const recommendations = {
                primarySolution: {
                    title: 'Ajustar parâmetros de memória CICS',
                    steps: [
                        'Verificar logs CICS utilizando comando CEMT I TAS',
                        'Analisar utilização atual de memória com CEMT I STA',
                        'Ajustar EDSALIM para 512M (aumentar de 256M)',
                        'Ajustar DSALIM para 1024M (aumentar de 512M)',
                        'Reiniciar região CICS PROD01 em janela de manutenção',
                        'Monitorar comportamento por 30 minutos pós-restart'
                    ],
                    estimatedTime: '2-4 horas',
                    successRate: 94,
                    risk: 'Baixo'
                },
                alternativeSolutions: [
                    {
                        title: 'Aplicar PTF de correção',
                        description: 'Aplicar PTF UI12345 que corrige vazamentos de memória',
                        successRate: 78,
                        estimatedTime: '6-8 horas'
                    },
                    {
                        title: 'Configurar pool de transações separado',
                        description: 'Criar pool dedicado para transações críticas',
                        successRate: 85,
                        estimatedTime: '4-6 horas'
                    }
                ],
                preventiveMeasures: [
                    'Implementar monitoramento automático de uso de memória',
                    'Criar alerta para 80% de utilização de memória',
                    'Revisar outras regiões CICS com configuração similar'
                ]
            };
            setAiRecommendations(recommendations);
            setConfidenceScore(94);
            setIsLoadingAI(false);
        }, 2000);
    };

    const handleResolveIncident = () => {
        const resolutionData = {
            incidentId: incident.id,
            resolutionMethod: showManualOverride ? 'manual' : 'ai-assisted',
            aiRecommendations: aiRecommendations,
            manualResolution: manualResolution,
            notes: resolutionNotes,
            confidenceScore: confidenceScore,
            timestamp: new Date().toISOString()
        };

        onResolve(resolutionData);
    };

    return (
        <div className="bg-white border-t-4 border-green-500 rounded-lg shadow-lg p-6 mt-6">
            <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
                🔧 Painel de Resolução Inteligente
                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Confiança: {confidenceScore}%
                </span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna Esquerda - Incidentes Similares */}
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                            📊 Incidentes Similares Resolvidos
                        </h4>
                        <div className="space-y-3">
                            {similarIncidents.map(inc => (
                                <div key={inc.id} className="bg-white p-3 rounded border-l-4 border-blue-400">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-medium text-sm">#{inc.id} - {inc.title}</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                            {inc.similarity}% similar
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-1">
                                        <strong>Resolução:</strong> {inc.resolution}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        <strong>Tempo:</strong> {inc.resolutionTime}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Artigos da Base de Conhecimento */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                            📚 Artigos Relevantes da KB
                        </h4>
                        <div className="space-y-2">
                            {kbArticles.map(article => (
                                <div key={article.id} className="bg-white p-3 rounded border-l-4 border-purple-400">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-sm">{article.title}</span>
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                            {article.relevance}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-2">{article.summary}</p>
                                    <button className="text-xs text-purple-600 hover:underline">
                                        Ver artigo completo →
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Coluna Direita - Recomendações de IA */}
                <div className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-yellow-800 flex items-center gap-2">
                                🤖 Recomendações de IA
                            </h4>
                            {!aiRecommendations && !isLoadingAI && (
                                <button
                                    onClick={generateAIRecommendations}
                                    className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                                >
                                    Gerar Recomendações
                                </button>
                            )}
                        </div>

                        {isLoadingAI && (
                            <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
                                <p className="text-sm text-yellow-700 mt-2">Analisando com IA...</p>
                            </div>
                        )}

                        {aiRecommendations && (
                            <div className="space-y-4">
                                {/* Solução Principal */}
                                <div className="bg-white p-3 rounded border-l-4 border-green-400">
                                    <h5 className="font-bold text-green-700 mb-2 flex items-center gap-2">
                                        ✅ Solução Recomendada
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                            {aiRecommendations.primarySolution.successRate}% sucesso
                                        </span>
                                    </h5>
                                    <p className="font-medium text-sm mb-2">{aiRecommendations.primarySolution.title}</p>
                                    <div className="text-xs space-y-1 mb-2">
                                        {aiRecommendations.primarySolution.steps.map((step, index) => (
                                            <div key={index} className="flex items-start gap-2">
                                                <span className="text-green-600 font-bold">{index + 1}.</span>
                                                <span>{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-600">
                                        <span>⏱️ {aiRecommendations.primarySolution.estimatedTime}</span>
                                        <span>🛡️ Risco: {aiRecommendations.primarySolution.risk}</span>
                                    </div>
                                </div>

                                {/* Soluções Alternativas */}
                                <div className="space-y-2">
                                    <h5 className="font-bold text-orange-700 text-sm">🔄 Soluções Alternativas</h5>
                                    {aiRecommendations.alternativeSolutions.map((alt, index) => (
                                        <div key={index} className="bg-orange-50 p-2 rounded text-xs">
                                            <div className="font-medium">{alt.title}</div>
                                            <div className="text-gray-600">{alt.description}</div>
                                            <div className="flex gap-2 mt-1 text-gray-500">
                                                <span>{alt.successRate}% sucesso</span>
                                                <span>⏱️ {alt.estimatedTime}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Medidas Preventivas */}
                                <div className="bg-blue-50 p-3 rounded">
                                    <h5 className="font-bold text-blue-700 text-sm mb-2">🛡️ Medidas Preventivas</h5>
                                    <ul className="text-xs space-y-1">
                                        {aiRecommendations.preventiveMeasures.map((measure, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span className="text-blue-600">•</span>
                                                <span>{measure}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Override Manual */}
                    <div className="bg-gray-50 p-4 rounded-lg" data-testid="manualOverride">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-gray-800">⚙️ Override Manual</h4>
                            <button
                                onClick={() => setShowManualOverride(!showManualOverride)}
                                className="text-sm text-gray-600 hover:text-gray-800"
                            >
                                {showManualOverride ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>

                        {showManualOverride && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Resolução Manual
                                    </label>
                                    <textarea
                                        className="w-full p-2 border rounded text-sm"
                                        rows="4"
                                        placeholder="Descreva a resolução manual aplicada..."
                                        value={manualResolution}
                                        onChange={(e) => setManualResolution(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Observações
                                    </label>
                                    <textarea
                                        className="w-full p-2 border rounded text-sm"
                                        rows="2"
                                        placeholder="Observações adicionais..."
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botão de Resolução */}
                    <div className="bg-green-50 p-4 rounded-lg">
                        <button
                            onClick={handleResolveIncident}
                            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                            disabled={!aiRecommendations && !manualResolution}
                        >
                            <span>✅</span>
                            Resolver Incidente
                            {confidenceScore > 0 && (
                                <span className="text-xs">({confidenceScore}% confiança)</span>
                            )}
                        </button>

                        {(!aiRecommendations && !manualResolution) && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Gere recomendações de IA ou adicione resolução manual para continuar
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Updated ViewModal to include the IncidentResolutionPanel
const ViewModalWithResolutionPanel = ({ incident, onClose }) => {
    const [showResolutionPanel, setShowResolutionPanel] = useState(false);

    if (!incident) return null;

    const handleResolveIncident = (resolutionData) => {
        console.log('Resolução aplicada:', resolutionData);
        alert('Incidente resolvido com sucesso!');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Existing ViewModal content */}
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Detalhes do Incidente #{incident.id}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {/* Incident details... */}

                {/* Button to show resolution panel */}
                {(incident.status === 'Aberto' || incident.status === 'Em Tratamento') && (
                    <div className="mt-4">
                        <button
                            onClick={() => setShowResolutionPanel(!showResolutionPanel)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                        >
                            <span>🔧</span>
                            {showResolutionPanel ? 'Ocultar Painel de Resolução' : 'Mostrar Painel de Resolução'}
                        </button>
                    </div>
                )}

                {/* Resolution Panel */}
                <IncidentResolutionPanel
                    incident={incident}
                    onResolve={handleResolveIncident}
                    isVisible={showResolutionPanel}
                />

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};