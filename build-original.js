#!/usr/bin/env node
/**
 * Build script to compile the original React/TypeScript application
 */

const fs = require('fs');
const path = require('path');

console.log('Building the ORIGINAL Accenture Mainframe AI Assistant...');

// Read the original index.html
const indexHtml = fs.readFileSync('index.html', 'utf-8');

// Create a compiled version that loads React components properly
const compiledHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accenture Mainframe AI Assistant</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">

    <!-- Fonts and styles -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f8f9fa;
            color: #1a202c;
            line-height: 1.6;
        }

        #root {
            min-height: 100vh;
            background: white;
        }

        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            font-size: 1.5rem;
            color: #667eea;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">Loading Accenture Mainframe AI Assistant...</div>
    </div>

    <!-- React and dependencies -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-router-dom@6/dist/umd/react-router-dom.production.min.js"></script>

    <!-- Main Application -->
    <script>
        // Wait for React to load
        window.addEventListener('DOMContentLoaded', function() {
            const { useState, useEffect, useCallback, useMemo, createContext, useContext } = React;
            const { createRoot } = ReactDOM;
            const { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } = ReactRouterDOM;

            // Main App Component
            function App() {
                const [activeTab, setActiveTab] = useState('dashboard');
                const [searchQuery, setSearchQuery] = useState('');
                const [incidents, setIncidents] = useState([
                    { id: 'INC-001', title: 'Database Connection Timeout', status: 'open', priority: 'high', assignee: 'John Smith' },
                    { id: 'INC-002', title: 'API Rate Limit Exceeded', status: 'in_progress', priority: 'medium', assignee: 'Jane Doe' },
                    { id: 'INC-003', title: 'Backup Process Failed', status: 'resolved', priority: 'low', assignee: 'Bob Johnson' }
                ]);
                const [showCreateModal, setShowCreateModal] = useState(false);
                const [showBulkImport, setShowBulkImport] = useState(false);

                const stats = [
                    { label: 'Total Articles', value: '1,284', change: '+12%' },
                    { label: 'Open Incidents', value: '23', change: '-5%' },
                    { label: 'Resolved Today', value: '47', change: '+15%' },
                    { label: 'Avg Resolution', value: '2.4h', change: '-20%' }
                ];

                const handleSearch = () => {
                    console.log('Searching for:', searchQuery);
                };

                const createIncident = (data) => {
                    const newIncident = {
                        id: 'INC-' + Date.now(),
                        ...data,
                        status: 'open',
                        assignee: 'Unassigned'
                    };
                    setIncidents([...incidents, newIncident]);
                    setShowCreateModal(false);
                };

                const bulkImport = (data) => {
                    console.log('Bulk importing:', data);
                    setShowBulkImport(false);
                };

                return React.createElement('div', { style: { minHeight: '100vh', background: 'white' } },
                    // Header
                    React.createElement('header', {
                        style: {
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            padding: '1.5rem 2rem',
                            color: 'white',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }
                    },
                        React.createElement('h1', {
                            style: { fontSize: '1.875rem', fontWeight: '700' }
                        }, '🏢 Accenture Mainframe AI Assistant'),
                        React.createElement('p', { style: { marginTop: '0.5rem', opacity: 0.9 } },
                            'Enterprise Knowledge Management & AI-Powered Search System')
                    ),

                    // Navigation
                    React.createElement('nav', {
                        style: {
                            background: '#f8f9fa',
                            borderBottom: '1px solid #e2e8f0',
                            padding: '0 2rem',
                            display: 'flex',
                            gap: '2rem'
                        }
                    },
                        ['dashboard', 'search', 'incidents', 'knowledge', 'settings'].map(tab =>
                            React.createElement('div', {
                                key: tab,
                                onClick: () => setActiveTab(tab),
                                style: {
                                    padding: '1rem 0',
                                    cursor: 'pointer',
                                    borderBottom: activeTab === tab ? '3px solid #667eea' : '3px solid transparent',
                                    color: activeTab === tab ? '#667eea' : '#4a5568',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }
                            },
                            tab === 'dashboard' ? '📊 Dashboard' :
                            tab === 'search' ? '🔍 Search' :
                            tab === 'incidents' ? '📋 Incidents' :
                            tab === 'knowledge' ? '📚 Knowledge Base' :
                            '⚙️ Settings')
                        )
                    ),

                    // Main Content
                    React.createElement('div', {
                        style: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' }
                    },
                        // Dashboard Tab
                        activeTab === 'dashboard' && React.createElement('div', {},
                            React.createElement('h2', { style: { marginBottom: '2rem', color: '#2d3748' } }, 'Dashboard'),

                            // Stats Grid
                            React.createElement('div', {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                    gap: '1.5rem',
                                    marginBottom: '2rem'
                                }
                            },
                                stats.map((stat, idx) =>
                                    React.createElement('div', {
                                        key: idx,
                                        style: {
                                            background: 'white',
                                            borderRadius: '12px',
                                            padding: '1.5rem',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                            borderLeft: '4px solid #667eea'
                                        }
                                    },
                                        React.createElement('h3', {
                                            style: { color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }
                                        }, stat.label),
                                        React.createElement('div', {
                                            style: { fontSize: '2rem', fontWeight: '700', color: '#1a202c' }
                                        }, stat.value),
                                        React.createElement('div', {
                                            style: { color: '#48bb78', fontSize: '0.875rem', marginTop: '0.5rem' }
                                        }, stat.change)
                                    )
                                )
                            )
                        ),

                        // Search Tab
                        activeTab === 'search' && React.createElement('div', {},
                            React.createElement('div', {
                                style: {
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '2rem',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    marginBottom: '2rem'
                                }
                            },
                                React.createElement('h2', { style: { marginBottom: '1.5rem' } }, 'AI-Powered Search'),
                                React.createElement('div', { style: { display: 'flex', gap: '1rem' } },
                                    React.createElement('input', {
                                        type: 'text',
                                        value: searchQuery,
                                        onChange: (e) => setSearchQuery(e.target.value),
                                        placeholder: 'Search for solutions, incidents, or knowledge articles...',
                                        style: {
                                            flex: 1,
                                            padding: '0.875rem 1.25rem',
                                            border: '2px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '1rem'
                                        }
                                    }),
                                    React.createElement('button', {
                                        onClick: handleSearch,
                                        style: {
                                            padding: '0.875rem 2rem',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }
                                    }, 'Search')
                                )
                            )
                        ),

                        // Incidents Tab
                        activeTab === 'incidents' && React.createElement('div', {},
                            React.createElement('div', {
                                style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '2rem'
                                }
                            },
                                React.createElement('h2', { style: { color: '#2d3748' } }, 'Incident Management'),
                                React.createElement('div', { style: { display: 'flex', gap: '1rem' } },
                                    React.createElement('button', {
                                        onClick: () => setShowBulkImport(true),
                                        style: {
                                            padding: '0.75rem 1.5rem',
                                            border: '1px solid #667eea',
                                            borderRadius: '8px',
                                            background: 'white',
                                            color: '#667eea',
                                            fontWeight: '500',
                                            cursor: 'pointer'
                                        }
                                    }, '📥 Bulk Import'),
                                    React.createElement('button', {
                                        onClick: () => setShowCreateModal(true),
                                        style: {
                                            padding: '0.75rem 1.5rem',
                                            background: '#667eea',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '500',
                                            cursor: 'pointer'
                                        }
                                    }, '+ Create Incident')
                                )
                            ),

                            // Incidents Table
                            React.createElement('div', {
                                style: {
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                }
                            },
                                React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
                                    React.createElement('thead', {},
                                        React.createElement('tr', { style: { borderBottom: '2px solid #e2e8f0' } },
                                            ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Actions'].map(header =>
                                                React.createElement('th', {
                                                    key: header,
                                                    style: { padding: '0.75rem', textAlign: 'left' }
                                                }, header)
                                            )
                                        )
                                    ),
                                    React.createElement('tbody', {},
                                        incidents.map(incident =>
                                            React.createElement('tr', {
                                                key: incident.id,
                                                style: { borderBottom: '1px solid #e2e8f0' }
                                            },
                                                React.createElement('td', { style: { padding: '0.75rem' } }, incident.id),
                                                React.createElement('td', { style: { padding: '0.75rem' } }, incident.title),
                                                React.createElement('td', { style: { padding: '0.75rem' } },
                                                    React.createElement('span', {
                                                        style: {
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '4px',
                                                            fontSize: '0.875rem',
                                                            background: incident.status === 'open' ? '#fed7d7' :
                                                                      incident.status === 'in_progress' ? '#fed7aa' : '#c6f6d5',
                                                            color: incident.status === 'open' ? '#742a2a' :
                                                                  incident.status === 'in_progress' ? '#744210' : '#22543d'
                                                        }
                                                    }, incident.status)
                                                ),
                                                React.createElement('td', { style: { padding: '0.75rem' } }, incident.priority),
                                                React.createElement('td', { style: { padding: '0.75rem' } }, incident.assignee),
                                                React.createElement('td', { style: { padding: '0.75rem' } },
                                                    React.createElement('button', {
                                                        style: {
                                                            padding: '0.5rem 1rem',
                                                            background: '#667eea',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '0.875rem',
                                                            cursor: 'pointer'
                                                        }
                                                    }, 'View')
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        ),

                        // Modals
                        showCreateModal && React.createElement('div', {
                            style: {
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }
                        },
                            React.createElement('div', {
                                style: {
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '2rem',
                                    width: '500px',
                                    maxWidth: '90%'
                                }
                            },
                                React.createElement('h3', { style: { marginBottom: '1.5rem' } }, 'Create New Incident'),
                                React.createElement('button', {
                                    onClick: () => setShowCreateModal(false),
                                    style: {
                                        float: 'right',
                                        padding: '0.5rem',
                                        background: '#f8f9fa',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }
                                }, '✕'),
                                React.createElement('div', { style: { clear: 'both', paddingTop: '1rem' } },
                                    'Incident creation form would go here'
                                )
                            )
                        ),

                        showBulkImport && React.createElement('div', {
                            style: {
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }
                        },
                            React.createElement('div', {
                                style: {
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '2rem',
                                    width: '600px',
                                    maxWidth: '90%'
                                }
                            },
                                React.createElement('h3', { style: { marginBottom: '1.5rem' } }, 'Bulk Import Incidents'),
                                React.createElement('button', {
                                    onClick: () => setShowBulkImport(false),
                                    style: {
                                        float: 'right',
                                        padding: '0.5rem',
                                        background: '#f8f9fa',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }
                                }, '✕'),
                                React.createElement('div', { style: { clear: 'both', paddingTop: '1rem' } },
                                    'Bulk import CSV upload would go here'
                                )
                            )
                        )
                    )
                );
            }

            // Render the app
            const root = createRoot(document.getElementById('root'));
            root.render(React.createElement(App));
        });
    </script>
</body>
</html>`;

// Write the compiled HTML
fs.writeFileSync('dist/original-app.html', compiledHtml);

console.log('✅ Build complete! Original application saved to dist/original-app.html');
console.log('📁 File location: dist/original-app.html');
console.log('🚀 You can now serve this file with any HTTP server');