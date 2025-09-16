// Standalone React App - Mainframe AI Assistant
// This is a self-contained JavaScript file that works without build tools

(function() {
    'use strict';

    // Create React-like component system
    const h = (tag, props, ...children) => {
        if (typeof tag === 'function') {
            return tag({ ...props, children });
        }
        const element = document.createElement(tag);

        if (props) {
            Object.entries(props).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else if (key.startsWith('on')) {
                    const eventName = key.slice(2).toLowerCase();
                    element.addEventListener(eventName, value);
                } else if (key === 'value') {
                    element.value = value;
                } else if (key === 'id') {
                    element.id = value;
                } else {
                    element.setAttribute(key, value);
                }
            });
        }

        children.forEach(child => {
            if (typeof child === 'string' || typeof child === 'number') {
                element.appendChild(document.createTextNode(child));
            } else if (child) {
                element.appendChild(child);
            }
        });

        return element;
    };

    // State management
    class StateManager {
        constructor() {
            this.state = {
                activeTab: 'dashboard',
                searchQuery: '',
                darkMode: false,
                entries: []
            };
            this.listeners = [];
        }

        subscribe(listener) {
            this.listeners.push(listener);
        }

        setState(updates) {
            this.state = { ...this.state, ...updates };
            this.listeners.forEach(listener => listener(this.state));
        }

        getState() {
            return this.state;
        }
    }

    const stateManager = new StateManager();

    // Components
    const Header = () => {
        return h('header', {
            style: {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }
        },
            h('div', { style: { maxWidth: '1200px', margin: '0 auto' } },
                h('h1', { style: { margin: 0, fontSize: '2rem' } }, '🚀 Mainframe AI Assistant'),
                h('p', { style: { margin: '0.5rem 0 0 0', opacity: 0.9 } },
                    'Knowledge Management & AI-Powered Search')
            )
        );
    };

    const TabButton = ({ label, icon, active, onClick }) => {
        return h('button', {
            onClick,
            style: {
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: active ? 'white' : 'transparent',
                color: active ? '#667eea' : '#666',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: active ? 'bold' : 'normal',
                transition: 'all 0.3s ease',
                marginRight: '0.5rem'
            }
        }, icon + ' ' + label);
    };

    const Navigation = () => {
        const state = stateManager.getState();

        return h('nav', {
            style: {
                background: '#f5f5f5',
                padding: '0 1.5rem',
                borderBottom: '1px solid #ddd'
            }
        },
            h('div', { style: { maxWidth: '1200px', margin: '0 auto', display: 'flex' } },
                TabButton({
                    label: 'Dashboard',
                    icon: '📊',
                    active: state.activeTab === 'dashboard',
                    onClick: () => stateManager.setState({ activeTab: 'dashboard' })
                }),
                TabButton({
                    label: 'Knowledge Base',
                    icon: '📚',
                    active: state.activeTab === 'knowledge',
                    onClick: () => stateManager.setState({ activeTab: 'knowledge' })
                }),
                TabButton({
                    label: 'Search',
                    icon: '🔍',
                    active: state.activeTab === 'search',
                    onClick: () => stateManager.setState({ activeTab: 'search' })
                }),
                TabButton({
                    label: 'Analytics',
                    icon: '📈',
                    active: state.activeTab === 'analytics',
                    onClick: () => stateManager.setState({ activeTab: 'analytics' })
                })
            )
        );
    };

    const DashboardContent = () => {
        const cards = [
            { title: 'Total Entries', value: '1,234', icon: '📝', color: '#667eea' },
            { title: 'Categories', value: '15', icon: '📁', color: '#764ba2' },
            { title: 'Search Queries', value: '5,678', icon: '🔍', color: '#f093fb' },
            { title: 'Performance', value: '98%', icon: '⚡', color: '#4facfe' }
        ];

        return h('div', { style: { padding: '2rem' } },
            h('h2', null, 'Dashboard Overview'),
            h('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem',
                    marginTop: '2rem'
                }
            },
                ...cards.map(card =>
                    h('div', {
                        style: {
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                            borderLeft: `4px solid ${card.color}`
                        }
                    },
                        h('div', { style: { fontSize: '2rem', marginBottom: '0.5rem' } }, card.icon),
                        h('h3', { style: { margin: '0 0 0.5rem 0', color: '#333' } }, card.title),
                        h('p', { style: { fontSize: '2rem', margin: 0, fontWeight: 'bold', color: card.color } },
                            card.value)
                    )
                )
            )
        );
    };

    const SearchContent = () => {
        const state = stateManager.getState();
        return h('div', { style: { padding: '2rem' } },
            h('h2', null, 'Search Knowledge Base'),
            h('div', { style: { marginTop: '2rem' } },
                h('input', {
                    type: 'text',
                    id: 'search-input',
                    value: state.searchQuery || '',
                    placeholder: 'Enter your search query...',
                    style: {
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box'
                    },
                    oninput: (e) => {
                        // Update state without triggering full re-render for each character
                        const value = e.target.value;
                        stateManager.state.searchQuery = value; // Direct update
                        console.log('Search query:', value);

                        // Only trigger re-render for visual feedback after a delay
                        clearTimeout(window.searchTimeout);
                        window.searchTimeout = setTimeout(() => {
                            stateManager.setState({ searchQuery: value });
                        }, 300); // Debounce 300ms
                    },
                    onkeyup: (e) => {
                        if (e.key === 'Enter') {
                            alert(`Searching for: ${e.target.value}`);
                        }
                    }
                }),
                h('button', {
                    style: {
                        marginTop: '1rem',
                        padding: '1rem 2rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    },
                    onClick: () => alert('Search functionality will be implemented soon!')
                }, '🔍 Search')
            ),
            state.searchQuery && h('div', {
                style: {
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: '#e8f4fd',
                    borderRadius: '8px',
                    border: '1px solid #bee5eb'
                }
            }, `Current search: "${state.searchQuery}"`),
            h('div', { style: { marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' } },
                h('p', null, 'Recent searches:'),
                h('ul', null,
                    h('li', null, 'API Documentation'),
                    h('li', null, 'Error Handling Best Practices'),
                    h('li', null, 'Performance Optimization')
                )
            )
        );
    };

    const KnowledgeContent = () => {
        return h('div', { style: { padding: '2rem' } },
            h('h2', null, 'Knowledge Base Management'),
            h('button', {
                style: {
                    padding: '1rem 2rem',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginBottom: '2rem'
                },
                onClick: () => alert('Add Entry form will be implemented soon!')
            }, '➕ Add New Entry'),
            h('div', { style: { background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' } },
                h('h3', null, 'Recent Entries'),
                h('table', { style: { width: '100%', borderCollapse: 'collapse' } },
                    h('thead', null,
                        h('tr', null,
                            h('th', { style: { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd' } }, 'Title'),
                            h('th', { style: { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd' } }, 'Category'),
                            h('th', { style: { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd' } }, 'Date')
                        )
                    ),
                    h('tbody', null,
                        h('tr', null,
                            h('td', { style: { padding: '0.5rem', borderBottom: '1px solid #eee' } }, 'Getting Started Guide'),
                            h('td', { style: { padding: '0.5rem', borderBottom: '1px solid #eee' } }, 'Documentation'),
                            h('td', { style: { padding: '0.5rem', borderBottom: '1px solid #eee' } }, '2024-09-15')
                        ),
                        h('tr', null,
                            h('td', { style: { padding: '0.5rem', borderBottom: '1px solid #eee' } }, 'API Reference'),
                            h('td', { style: { padding: '0.5rem', borderBottom: '1px solid #eee' } }, 'Technical'),
                            h('td', { style: { padding: '0.5rem', borderBottom: '1px solid #eee' } }, '2024-09-14')
                        )
                    )
                )
            )
        );
    };

    const AnalyticsContent = () => {
        return h('div', { style: { padding: '2rem' } },
            h('h2', null, 'Analytics & Performance'),
            h('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1.5rem',
                    marginTop: '2rem'
                }
            },
                h('div', { style: { background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' } },
                    h('h3', null, '📊 Search Performance'),
                    h('p', null, 'Average response time: 45ms'),
                    h('p', null, 'Cache hit rate: 87%'),
                    h('p', null, 'Total queries today: 234')
                ),
                h('div', { style: { background: 'white', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' } },
                    h('h3', null, '📈 Usage Trends'),
                    h('p', null, 'Active users: 42'),
                    h('p', null, 'Peak hours: 10-11 AM'),
                    h('p', null, 'Most searched: "API Documentation"')
                )
            )
        );
    };

    const MainContent = () => {
        const state = stateManager.getState();

        const content = {
            dashboard: DashboardContent(),
            knowledge: KnowledgeContent(),
            search: SearchContent(),
            analytics: AnalyticsContent()
        };

        return h('main', {
            style: {
                maxWidth: '1200px',
                margin: '0 auto',
                minHeight: 'calc(100vh - 200px)',
                background: 'white',
                borderRadius: '0 0 8px 8px'
            }
        }, content[state.activeTab] || DashboardContent());
    };

    const Footer = () => {
        return h('footer', {
            style: {
                background: '#333',
                color: 'white',
                padding: '1.5rem',
                textAlign: 'center',
                marginTop: '2rem'
            }
        },
            h('p', { style: { margin: 0 } }, '© 2024 Mainframe AI Assistant'),
            h('p', { style: { margin: '0.5rem 0 0 0', opacity: 0.7 } },
                'Powered by React-like Components | Version 1.0.0')
        );
    };

    // Main App
    const App = () => {
        return h('div', { style: { background: '#f0f0f0', minHeight: '100vh' } },
            Header(),
            Navigation(),
            MainContent(),
            Footer()
        );
    };

    // Render function with focus preservation
    const render = () => {
        const root = document.getElementById('root');
        if (root) {
            // Save current focus and cursor position
            const activeElement = document.activeElement;
            const isSearchInput = activeElement && activeElement.id === 'search-input';
            const cursorPosition = isSearchInput ? activeElement.selectionStart : null;
            const inputValue = isSearchInput ? activeElement.value : null;

            // Re-render
            root.innerHTML = '';
            root.appendChild(App());

            // Restore focus and cursor position if it was the search input
            if (isSearchInput) {
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.value = inputValue || stateManager.getState().searchQuery || '';
                    if (cursorPosition !== null) {
                        searchInput.setSelectionRange(cursorPosition, cursorPosition);
                    }
                }
            }
        }
    };

    // Subscribe to state changes
    stateManager.subscribe(render);

    // Initial render
    document.addEventListener('DOMContentLoaded', render);

    // Export for debugging
    window.MainframeApp = {
        stateManager,
        render
    };

    console.log('✅ Mainframe AI Assistant loaded successfully!');
})();