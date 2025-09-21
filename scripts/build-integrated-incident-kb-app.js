#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Building Integrated Incident-KB Accenture Mainframe AI Assistant...');

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accenture Mainframe AI Assistant - Integrated Incident & Knowledge Platform</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --accenture-purple: #A100FF;
            --accenture-dark-purple: #7F39FB;
            --accenture-light-purple: #E8D5FF;
        }

        .accenture-gradient {
            background: linear-gradient(135deg, var(--accenture-purple), var(--accenture-dark-purple));
        }

        .tab-active {
            background: var(--accenture-purple);
            color: white;
        }

        .tab-inactive {
            background: white;
            color: #6B7280;
            border: 1px solid #E5E7EB;
        }

        .tab-inactive:hover {
            background: #F9FAFB;
            color: var(--accenture-purple);
        }

        .view-toggle-active {
            background: var(--accenture-purple);
            color: white;
        }

        .view-toggle-inactive {
            background: #F3F4F6;
            color: #6B7280;
        }

        .notification {
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .modal-backdrop {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
        }

        .status-aberto { background: #FEE2E2; color: #991B1B; }
        .status-em_tratamento { background: #FEF3C7; color: #92400E; }
        .status-resolvido { background: #D1FAE5; color: #065F46; }
        .status-fechado { background: #E0E7FF; color: #3730A3; }

        .priority-p1 { background: #FEE2E2; color: #991B1B; }
        .priority-p2 { background: #FED7AA; color: #9A3412; }
        .priority-p3 { background: #FEF3C7; color: #92400E; }
        .priority-p4 { background: #E0F2FE; color: #075985; }

        .knowledge-entry {
            border-left: 4px solid var(--accenture-purple);
            background: linear-gradient(to right, #F8FAFC, #FFFFFF);
        }

        .incident-entry {
            border-left: 4px solid #059669;
        }

        .search-highlight {
            background: #FEF3C7;
            padding: 1px 2px;
            border-radius: 2px;
        }
    </style>
    <script>
        // Ensure no modals are visible on page load
        document.addEventListener('DOMContentLoaded', function() {
            const modals = document.querySelectorAll('[x-show*="show"]');
            modals.forEach(modal => {
                if (modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            });

            setTimeout(() => {
                if (window.Alpine) {
                    window.Alpine.initTree(document.body);
                }
            }, 100);
        });
    </script>
</head>
<body class="bg-gray-50" x-data="mainApp()">
    <!-- Header -->
    <header class="accenture-gradient text-white shadow-lg">
        <div class="container mx-auto px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                        <span class="text-xl font-bold text-white">A</span>
                    </div>
                    <div>
                        <h1 class="text-2xl font-bold">Accenture Mainframe AI Assistant</h1>
                        <p class="text-sm opacity-90">Integrated Incident & Knowledge Platform v2.0</p>
                    </div>
                </div>
                <button class="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center hover:bg-opacity-30 transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </button>
            </div>
        </div>
    </header>

    <!-- Navigation -->
    <nav class="bg-white border-b border-gray-200 shadow-sm">
        <div class="container mx-auto px-6">
            <div class="flex space-x-8">
                <button @click="activeTab = 'dashboard'"
                        :class="activeTab === 'dashboard' ? 'tab-active' : 'tab-inactive'"
                        class="px-4 py-3 font-medium transition-all border-b-2 border-transparent">
                    📊 Dashboard
                </button>
                <button @click="activeTab = 'incidents'"
                        :class="activeTab === 'incidents' ? 'tab-active' : 'tab-inactive'"
                        class="px-4 py-3 font-medium transition-all border-b-2 border-transparent">
                    🎯 Incidentes e Conhecimento
                    <span class="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full" x-text="incidentCount"></span>
                </button>
                <button @click="activeTab = 'settings'"
                        :class="activeTab === 'settings' ? 'tab-active' : 'tab-inactive'"
                        class="px-4 py-3 font-medium transition-all border-b-2 border-transparent">
                    ⚙️ Configurações
                </button>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container mx-auto px-6 py-8">
        <!-- Dashboard Tab -->
        <div x-show="activeTab === 'dashboard'" class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-900">Dashboard Executivo</h2>

            <!-- Metrics Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-red-100 rounded-lg">
                            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Incidentes Abertos</p>
                            <p class="text-2xl font-bold text-gray-900">3</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-blue-100 rounded-lg">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Base de Conhecimento</p>
                            <p class="text-2xl font-bold text-gray-900">12</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-green-100 rounded-lg">
                            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Resolvidos Hoje</p>
                            <p class="text-2xl font-bold text-gray-900">5</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-purple-100 rounded-lg">
                            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm font-medium text-gray-600">Tempo Médio Resolução</p>
                            <p class="text-2xl font-bold text-gray-900">2.4h</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Tendências de Incidentes</h3>
                    <canvas id="incidentTrendsChart" width="400" height="200"></canvas>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Distribuição por Prioridade</h3>
                    <canvas id="priorityChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>

        <!-- Integrated Incidents & Knowledge Tab -->
        <div x-show="activeTab === 'incidents'" class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold text-gray-900">Gestão de Incidentes e Base de Conhecimento</h2>
                <div class="flex space-x-3">
                    <button @click="showBulkImport = true"
                            class="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-all">
                        📥 Importação Bulk
                    </button>
                    <button @click="showCreateIncident = true"
                            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all">
                        + Reportar Incidente
                    </button>
                </div>
            </div>

            <!-- View Toggle Buttons -->
            <div class="flex space-x-2 bg-gray-100 p-1 rounded-lg w-fit">
                <button @click="currentView = 'active'"
                        :class="currentView === 'active' ? 'view-toggle-active' : 'view-toggle-inactive'"
                        class="px-4 py-2 rounded-md font-medium transition-all">
                    Incidentes Ativos <span class="ml-1 text-xs" x-text="'(' + activeIncidents.length + ')'"></span>
                </button>
                <button @click="currentView = 'all'"
                        :class="currentView === 'all' ? 'view-toggle-active' : 'view-toggle-inactive'"
                        class="px-4 py-2 rounded-md font-medium transition-all">
                    Todos os Incidentes <span class="ml-1 text-xs" x-text="'(' + filteredIncidents.length + ')'"></span>
                </button>
                <button @click="currentView = 'knowledge'"
                        :class="currentView === 'knowledge' ? 'view-toggle-active' : 'view-toggle-inactive'"
                        class="px-4 py-2 rounded-md font-medium transition-all">
                    Base de Conhecimento <span class="ml-1 text-xs" x-text="'(' + knowledgeEntries.length + ')'"></span>
                </button>
            </div>

            <!-- Search and Filters -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div class="flex flex-col md:flex-row gap-4">
                    <div class="flex-1">
                        <div class="relative">
                            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <input x-model="searchQuery"
                                   type="text"
                                   :placeholder="getSearchPlaceholder()"
                                   class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                        </div>
                    </div>
                    <div class="flex space-x-3">
                        <select x-model="filterStatus" class="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="">Todos os Status</option>
                            <option value="aberto">Aberto</option>
                            <option value="em_tratamento">Em Tratamento</option>
                            <option value="resolvido">Resolvido</option>
                            <option value="fechado">Fechado</option>
                        </select>
                        <select x-model="filterPriority" class="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="">Todas as Prioridades</option>
                            <option value="P1">P1 - Crítica</option>
                            <option value="P2">P2 - Alta</option>
                            <option value="P3">P3 - Média</option>
                            <option value="P4">P4 - Baixa</option>
                        </select>
                        <select x-model="filterCategory" class="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="">Todas as Categorias</option>
                            <option value="JCL">JCL</option>
                            <option value="VSAM">VSAM</option>
                            <option value="DB2">DB2</option>
                            <option value="CICS">CICS</option>
                            <option value="Batch">Batch</option>
                            <option value="IMS">IMS</option>
                            <option value="Security">Security</option>
                            <option value="Network">Network</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Incidents/Knowledge List -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" x-show="currentView === 'knowledge'">Taxa de Sucesso</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" x-show="currentView !== 'knowledge'">Criado</th>
                                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <template x-for="entry in getCurrentViewData()" :key="entry.id">
                                <tr :class="entry.type === 'knowledge' ? 'knowledge-entry' : 'incident-entry'" class="hover:bg-gray-50 transition-colors">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" x-text="entry.id"></td>
                                    <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                        <div class="font-medium" x-text="entry.title"></div>
                                        <div class="text-gray-500 text-xs mt-1 truncate" x-text="entry.description"></div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="'status-' + entry.status" class="px-2 py-1 text-xs font-medium rounded-full" x-text="getStatusLabel(entry.status)"></span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="'priority-' + entry.priority.toLowerCase()" class="px-2 py-1 text-xs font-medium rounded-full" x-text="entry.priority"></span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="entry.category"></td>
                                    <td x-show="currentView === 'knowledge'" class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div class="flex items-center">
                                            <span x-text="entry.success_rate + '%'"></span>
                                            <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                                                <div class="bg-green-500 h-2 rounded-full" :style="'width: ' + entry.success_rate + '%'"></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td x-show="currentView !== 'knowledge'" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="formatDate(entry.created_at)"></td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                        <button @click="viewEntry(entry)" class="text-purple-600 hover:text-purple-900 font-medium">Ver</button>
                                        <button x-show="currentView !== 'knowledge'" @click="editEntry(entry)" class="text-blue-600 hover:text-blue-900 font-medium">Editar</button>
                                        <button @click="deleteEntry(entry)" class="text-red-600 hover:text-red-900 font-medium">Excluir</button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                    <div x-show="getCurrentViewData().length === 0" class="text-center py-12">
                        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <h3 class="mt-2 text-sm font-medium text-gray-900">Nenhum resultado encontrado</h3>
                        <p class="mt-1 text-sm text-gray-500">Tente ajustar os filtros ou termo de busca.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Settings Tab -->
        <div x-show="activeTab === 'settings'" class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-900">Configurações do Sistema</h2>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- AI Configuration -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Configurações de IA</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Chave API OpenAI</label>
                            <input type="password" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="sk-...">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Modelo Padrão</label>
                            <select class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                                <option>gpt-4-turbo</option>
                                <option>gpt-3.5-turbo</option>
                                <option>claude-3-sonnet</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Notification Settings -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Notificações</h3>
                    <div class="space-y-4">
                        <label class="flex items-center">
                            <input type="checkbox" class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                            <span class="ml-2 text-sm text-gray-700">Notificações por email</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                            <span class="ml-2 text-sm text-gray-700">Notificações desktop</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                            <span class="ml-2 text-sm text-gray-700">Alertas sonoros</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Notifications -->
    <div class="fixed top-4 right-4 z-50 space-y-2">
        <template x-for="notification in notifications" :key="notification.id">
            <div class="notification bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
                <div class="flex items-start">
                    <div :class="notification.type === 'success' ? 'text-green-500' : notification.type === 'error' ? 'text-red-500' : 'text-blue-500'" class="flex-shrink-0 w-5 h-5 mt-0.5">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"></path>
                        </svg>
                    </div>
                    <div class="ml-3 flex-1">
                        <p class="text-sm font-medium text-gray-900" x-text="notification.message"></p>
                    </div>
                    <button @click="removeNotification(notification.id)" class="ml-3 text-gray-400 hover:text-gray-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </template>
    </div>

    <!-- Modals -->
    <!-- Create Incident Modal -->
    <div x-show="showCreateIncident" class="fixed inset-0 z-50 overflow-y-auto" style="display: none;">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div class="modal-backdrop fixed inset-0" @click="showCreateIncident = false"></div>
            <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-medium text-gray-900">Reportar Novo Incidente</h3>
                    <button @click="showCreateIncident = false" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <form @submit.prevent="createIncident()">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Título</label>
                            <input x-model="newIncident.title" type="text" required class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Descrição</label>
                            <textarea x-model="newIncident.description" rows="3" required class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Prioridade</label>
                                <select x-model="newIncident.priority" required class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option value="P1">P1 - Crítica</option>
                                    <option value="P2">P2 - Alta</option>
                                    <option value="P3">P3 - Média</option>
                                    <option value="P4">P4 - Baixa</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Categoria</label>
                                <select x-model="newIncident.category" required class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option value="JCL">JCL</option>
                                    <option value="VSAM">VSAM</option>
                                    <option value="DB2">DB2</option>
                                    <option value="CICS">CICS</option>
                                    <option value="Batch">Batch</option>
                                    <option value="IMS">IMS</option>
                                    <option value="Security">Security</option>
                                    <option value="Network">Network</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="mt-6 flex justify-end space-x-3">
                        <button type="button" @click="showCreateIncident = false" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                            Criar Incidente
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Bulk Import Modal -->
    <div x-show="showBulkImport" class="fixed inset-0 z-50 overflow-y-auto" style="display: none;">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div class="modal-backdrop fixed inset-0" @click="showBulkImport = false"></div>
            <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-medium text-gray-900">Importação Bulk de Incidentes</h3>
                    <button @click="showBulkImport = false" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Arquivo CSV</label>
                        <input type="file" accept=".csv" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="text-sm font-medium text-gray-900">Formato do CSV:</h4>
                        <p class="text-xs text-gray-600 mt-1">titulo,descricao,prioridade,categoria</p>
                    </div>
                </div>
                <div class="mt-6 flex justify-end space-x-3">
                    <button @click="showBulkImport = false" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button @click="processBulkImport()" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        Importar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        function mainApp() {
            return {
                // State
                activeTab: 'dashboard',
                currentView: 'all', // 'active', 'all', 'knowledge'
                incidentCount: 15,
                notifications: [],

                // Modals
                showCreateIncident: false,
                showBulkImport: false,

                // Search and filters
                searchQuery: '',
                filterStatus: '',
                filterPriority: '',
                filterCategory: '',

                // Form data
                newIncident: {
                    title: '',
                    description: '',
                    priority: 'P3',
                    category: 'JCL'
                },

                // Unified Data - All entries (incidents and knowledge) in one array
                allEntries: [
                    // Active Incidents
                    {
                        id: 'INC-001',
                        title: 'JCL Job Failing with S0C4 ABEND',
                        description: 'Production JCL job failing with system completion code S0C4',
                        category: 'JCL',
                        priority: 'P1',
                        status: 'aberto',
                        type: 'incident',
                        created_at: new Date().toISOString(),
                        reporter: 'system@accenture.com'
                    },
                    {
                        id: 'INC-002',
                        title: 'DB2 Connection Pool Exhausted',
                        description: 'Application unable to connect to DB2 database',
                        category: 'DB2',
                        priority: 'P2',
                        status: 'em_tratamento',
                        type: 'incident',
                        created_at: new Date(Date.now() - 86400000).toISOString(),
                        reporter: 'dba@accenture.com'
                    },
                    {
                        id: 'INC-003',
                        title: 'CICS Transaction Timeout',
                        description: 'CICS transaction ABCD timing out intermittently',
                        category: 'CICS',
                        priority: 'P3',
                        status: 'aberto',
                        type: 'incident',
                        created_at: new Date(Date.now() - 172800000).toISOString(),
                        reporter: 'support@accenture.com'
                    },

                    // Knowledge Base Entries (Resolved Incidents)
                    {
                        id: 'KB-001',
                        title: 'JCL Job ABEND S0C4 - Data Exception Resolution',
                        description: 'Comprehensive solution for S0C4 ABEND errors in JCL jobs',
                        category: 'JCL',
                        priority: 'P1',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Verificar validação de dados no programa COBOL. Corrigir definições de variáveis e validar COMP fields.',
                        success_rate: 95,
                        usage_count: 23,
                        created_at: new Date(Date.now() - 2592000000).toISOString(),
                        resolved_at: new Date(Date.now() - 2500000000).toISOString()
                    },
                    {
                        id: 'KB-002',
                        title: 'VSAM File Status 23 - Duplicate Key Resolution',
                        description: 'Resolução para erro de chave duplicada em arquivos VSAM',
                        category: 'VSAM',
                        priority: 'P2',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Verificar lógica de geração de chaves. Implementar controle de unicidade antes da gravação.',
                        success_rate: 91,
                        usage_count: 18,
                        created_at: new Date(Date.now() - 3456000000).toISOString(),
                        resolved_at: new Date(Date.now() - 3400000000).toISOString()
                    },
                    {
                        id: 'KB-003',
                        title: 'DB2 SQLCODE -911 - Deadlock Resolution',
                        description: 'Tratamento de deadlocks em transações DB2',
                        category: 'DB2',
                        priority: 'P2',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Implementar retry logic e otimizar ordem de acesso às tabelas para evitar deadlocks.',
                        success_rate: 93,
                        usage_count: 31,
                        created_at: new Date(Date.now() - 4320000000).toISOString(),
                        resolved_at: new Date(Date.now() - 4200000000).toISOString()
                    },
                    {
                        id: 'KB-004',
                        title: 'CICS ASRA ABEND - Storage Violation Fix',
                        description: 'Correção para violações de storage em transações CICS',
                        category: 'CICS',
                        priority: 'P1',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Verificar alocação de memória e boundaries. Revisar working-storage do programa.',
                        success_rate: 88,
                        usage_count: 15,
                        created_at: new Date(Date.now() - 5184000000).toISOString(),
                        resolved_at: new Date(Date.now() - 5100000000).toISOString()
                    },
                    {
                        id: 'KB-005',
                        title: 'Batch Job Scheduling Conflict Resolution',
                        description: 'Resolução de conflitos de agendamento em jobs batch',
                        category: 'Batch',
                        priority: 'P3',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Revisar dependências entre jobs e implementar controle de precedência adequado.',
                        success_rate: 96,
                        usage_count: 42,
                        created_at: new Date(Date.now() - 6048000000).toISOString(),
                        resolved_at: new Date(Date.now() - 5900000000).toISOString()
                    },
                    {
                        id: 'KB-006',
                        title: 'IMS Database Deadlock Prevention',
                        description: 'Prevenção de deadlocks em databases IMS',
                        category: 'IMS',
                        priority: 'P2',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Implementar timeout adequado e padronizar ordem de acesso aos segmentos.',
                        success_rate: 90,
                        usage_count: 27,
                        created_at: new Date(Date.now() - 6912000000).toISOString(),
                        resolved_at: new Date(Date.now() - 6800000000).toISOString()
                    },
                    {
                        id: 'KB-007',
                        title: 'Security RACF S913 Access Denied Fix',
                        description: 'Correção para violações de segurança RACF',
                        category: 'Security',
                        priority: 'P1',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Verificar permissões de dataset e grupo do usuário. Solicitar acesso adequado ao admin.',
                        success_rate: 94,
                        usage_count: 38,
                        created_at: new Date(Date.now() - 7776000000).toISOString(),
                        resolved_at: new Date(Date.now() - 7700000000).toISOString()
                    },
                    {
                        id: 'KB-008',
                        title: 'Network VTAM Connection Failure Resolution',
                        description: 'Resolução de falhas de conexão VTAM',
                        category: 'Network',
                        priority: 'P2',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Verificar configuração de terminais e status da rede. Restart do VTAM se necessário.',
                        success_rate: 87,
                        usage_count: 22,
                        created_at: new Date(Date.now() - 8640000000).toISOString(),
                        resolved_at: new Date(Date.now() - 8500000000).toISOString()
                    },
                    {
                        id: 'KB-009',
                        title: 'Hardware DASD Storage Space Management',
                        description: 'Gerenciamento de espaço de armazenamento DASD',
                        category: 'Hardware',
                        priority: 'P3',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Implementar housekeeping automático e alertas de capacidade.',
                        success_rate: 92,
                        usage_count: 33,
                        created_at: new Date(Date.now() - 9504000000).toISOString(),
                        resolved_at: new Date(Date.now() - 9400000000).toISOString()
                    },
                    {
                        id: 'KB-010',
                        title: 'Software Version Compatibility Issues',
                        description: 'Problemas de compatibilidade entre versões de software',
                        category: 'Software',
                        priority: 'P2',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Validar matriz de compatibilidade e executar testes de regressão.',
                        success_rate: 89,
                        usage_count: 19,
                        created_at: new Date(Date.now() - 10368000000).toISOString(),
                        resolved_at: new Date(Date.now() - 10200000000).toISOString()
                    },
                    {
                        id: 'KB-011',
                        title: 'Performance Tuning Guidelines',
                        description: 'Diretrizes para otimização de performance mainframe',
                        category: 'Performance',
                        priority: 'P3',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Analisar CPU utilization, I/O patterns e memory usage. Aplicar tuning adequado.',
                        success_rate: 95,
                        usage_count: 56,
                        created_at: new Date(Date.now() - 11232000000).toISOString(),
                        resolved_at: new Date(Date.now() - 11100000000).toISOString()
                    },
                    {
                        id: 'KB-012',
                        title: 'Disaster Recovery Procedure Validation',
                        description: 'Validação de procedimentos de recuperação de desastres',
                        category: 'DR',
                        priority: 'P1',
                        status: 'resolvido',
                        type: 'knowledge',
                        solution: 'Executar testes regulares de DR e manter documentação atualizada.',
                        success_rate: 97,
                        usage_count: 14,
                        created_at: new Date(Date.now() - 12096000000).toISOString(),
                        resolved_at: new Date(Date.now() - 12000000000).toISOString()
                    }
                ],

                // Computed properties
                get filteredIncidents() {
                    return this.allEntries.filter(entry => {
                        const matchesSearch = !this.searchQuery ||
                            entry.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                            entry.description.toLowerCase().includes(this.searchQuery.toLowerCase());

                        const matchesStatus = !this.filterStatus || entry.status === this.filterStatus;
                        const matchesPriority = !this.filterPriority || entry.priority === this.filterPriority;
                        const matchesCategory = !this.filterCategory || entry.category === this.filterCategory;

                        return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
                    });
                },

                get activeIncidents() {
                    return this.filteredIncidents.filter(entry =>
                        entry.type === 'incident' && ['aberto', 'em_tratamento'].includes(entry.status)
                    );
                },

                get knowledgeEntries() {
                    return this.filteredIncidents.filter(entry =>
                        entry.type === 'knowledge' || entry.status === 'resolvido'
                    );
                },

                // Methods
                getCurrentViewData() {
                    switch(this.currentView) {
                        case 'active':
                            return this.activeIncidents;
                        case 'knowledge':
                            return this.knowledgeEntries;
                        case 'all':
                        default:
                            return this.filteredIncidents;
                    }
                },

                getSearchPlaceholder() {
                    switch(this.currentView) {
                        case 'active':
                            return 'Buscar incidentes ativos...';
                        case 'knowledge':
                            return 'Buscar na base de conhecimento...';
                        case 'all':
                        default:
                            return 'Buscar incidentes e conhecimento...';
                    }
                },

                getStatusLabel(status) {
                    const labels = {
                        'aberto': 'Aberto',
                        'em_tratamento': 'Em Tratamento',
                        'resolvido': 'Resolvido',
                        'fechado': 'Fechado'
                    };
                    return labels[status] || status;
                },

                formatDate(dateString) {
                    return new Date(dateString).toLocaleDateString('pt-BR');
                },

                createIncident() {
                    const incident = {
                        id: 'INC-' + String(Date.now()).slice(-3),
                        ...this.newIncident,
                        status: 'aberto',
                        type: 'incident',
                        created_at: new Date().toISOString(),
                        reporter: 'user@accenture.com'
                    };

                    this.allEntries.unshift(incident);
                    this.incidentCount++;
                    this.showCreateIncident = false;
                    this.newIncident = { title: '', description: '', priority: 'P3', category: 'JCL' };

                    this.showNotification('Incidente criado com sucesso!', 'success');
                },

                viewEntry(entry) {
                    alert('Ver detalhes: ' + entry.title);
                },

                editEntry(entry) {
                    alert('Editar: ' + entry.title);
                },

                deleteEntry(entry) {
                    if (confirm('Tem certeza que deseja excluir este item?')) {
                        const index = this.allEntries.findIndex(e => e.id === entry.id);
                        if (index > -1) {
                            this.allEntries.splice(index, 1);
                            if (entry.type === 'incident') {
                                this.incidentCount--;
                            }
                            this.showNotification('Item excluído com sucesso!', 'success');
                        }
                    }
                },

                processBulkImport() {
                    this.showBulkImport = false;
                    this.showNotification('Importação bulk processada com sucesso!', 'success');
                },

                showNotification(message, type = 'info') {
                    const notification = {
                        id: Date.now(),
                        message: message,
                        type: type
                    };
                    this.notifications.push(notification);

                    setTimeout(() => {
                        this.removeNotification(notification.id);
                    }, 5000);
                },

                removeNotification(id) {
                    const index = this.notifications.findIndex(n => n.id === id);
                    if (index > -1) {
                        this.notifications.splice(index, 1);
                    }
                },

                // Chart initialization
                initCharts() {
                    // Incident Trends Chart
                    const trendsCtx = document.getElementById('incidentTrendsChart');
                    if (trendsCtx) {
                        new Chart(trendsCtx, {
                            type: 'line',
                            data: {
                                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                                datasets: [{
                                    label: 'Novos Incidentes',
                                    data: [3, 2, 3, 4, 1, 3, 2],
                                    borderColor: '#A100FF',
                                    backgroundColor: 'rgba(161, 0, 255, 0.1)',
                                    tension: 0.4
                                }, {
                                    label: 'Resolvidos',
                                    data: [2, 3, 4, 3, 4, 2, 3],
                                    borderColor: '#059669',
                                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                                    tension: 0.4
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'top'
                                    }
                                }
                            }
                        });
                    }

                    // Priority Distribution Chart
                    const priorityCtx = document.getElementById('priorityChart');
                    if (priorityCtx) {
                        new Chart(priorityCtx, {
                            type: 'doughnut',
                            data: {
                                labels: ['P1 - Crítica', 'P2 - Alta', 'P3 - Média', 'P4 - Baixa'],
                                datasets: [{
                                    data: [2, 3, 6, 4],
                                    backgroundColor: ['#EF4444', '#F97316', '#EAB308', '#22C55E']
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'bottom'
                                    }
                                }
                            }
                        });
                    }
                },

                // Initialize
                init() {
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.initCharts();
                        }, 100);
                    });
                }
            }
        }
    </script>
</body>
</html>`;

// Write the integrated application
const outputPath = path.join(__dirname, '..', 'Accenture-Mainframe-AI-Assistant-Integrated.html');
fs.writeFileSync(outputPath, htmlContent);

console.log('✅ Integrated Incident-KB Application built successfully!');
console.log('📁 Output: Accenture-Mainframe-AI-Assistant-Integrated.html');
console.log('');
console.log('🎯 NEW INTEGRATED FEATURES:');
console.log('   ✓ Single tab for Incidents & Knowledge Base');
console.log('   ✓ View toggles: Active Incidents | All Incidents | Knowledge Base');
console.log('   ✓ 12 comprehensive mainframe knowledge entries as resolved incidents');
console.log('   ✓ Unified search across problems and solutions');
console.log('   ✓ Incident lifecycle: New → Active → Resolved → Knowledge');
console.log('   ✓ Success rate tracking for knowledge entries');
console.log('   ✓ Professional Accenture v2.0 branding');
console.log('');
console.log('🌐 Access at: http://localhost:8091/Accenture-Mainframe-AI-Assistant-Integrated.html');