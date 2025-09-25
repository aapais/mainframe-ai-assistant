// Category Incidents Card with Pagination
// Component for Dashboard showing incidents by category with pagination

window.CategoryIncidentsCard = function() {
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(5);
    const [categoryStats, setCategoryStats] = React.useState({});

    // Load category stats from incidents
    React.useEffect(() => {
        // Get incidents from parent or context
        const incidents = window.allIncidents || [];
        const stats = {};

        incidents.forEach(incident => {
            const category = incident.category || 'Outros';
            stats[category] = (stats[category] || 0) + 1;
        });

        setCategoryStats(stats);
    }, []);

    // Convert to array and sort by count
    const categoryArray = Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count }));

    // Calculate pagination
    const totalItems = categoryArray.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = categoryArray.slice(startIndex, endIndex);

    // Calculate total for percentages
    const total = Object.values(categoryStats).reduce((sum, c) => sum + c, 0);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleItemsPerPageChange = (value) => {
        setItemsPerPage(parseInt(value));
        setCurrentPage(1); // Reset to first page
    };

    return React.createElement('div', {
        className: 'bg-white p-6 rounded-lg shadow'
    }, [
        // Header
        React.createElement('div', {
            key: 'header',
            className: 'flex justify-between items-center mb-4'
        }, [
            React.createElement('h3', {
                key: 'title',
                className: 'text-lg font-semibold'
            }, 'Incidentes por Categoria'),
            React.createElement('div', {
                key: 'controls',
                className: 'flex items-center gap-2'
            }, [
                React.createElement('span', {
                    key: 'label',
                    className: 'text-sm text-gray-600'
                }, 'Mostrar:'),
                React.createElement('select', {
                    key: 'select',
                    value: itemsPerPage,
                    onChange: (e) => handleItemsPerPageChange(e.target.value),
                    className: 'text-sm border rounded px-2 py-1'
                }, [
                    React.createElement('option', { key: '5', value: 5 }, '5'),
                    React.createElement('option', { key: '10', value: 10 }, '10'),
                    React.createElement('option', { key: '15', value: 15 }, '15'),
                    React.createElement('option', { key: 'all', value: 1000 }, 'Todos')
                ])
            ])
        ]),

        // Stats Display
        React.createElement('div', {
            key: 'stats',
            className: 'space-y-2 mb-4'
        }, currentItems.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            return React.createElement('div', {
                key: item.category,
                className: 'flex items-center justify-between'
            }, [
                React.createElement('span', {
                    key: 'category',
                    className: 'text-sm font-medium truncate max-w-[150px]',
                    title: item.category
                }, item.category),
                React.createElement('div', {
                    key: 'bar',
                    className: 'flex items-center gap-2 flex-1 ml-3'
                }, [
                    React.createElement('div', {
                        key: 'progress',
                        className: 'flex-1 bg-gray-200 rounded-full h-2 max-w-[150px]'
                    },
                        React.createElement('div', {
                            className: 'bg-purple-600 h-2 rounded-full transition-all duration-300',
                            style: { width: `${percentage}%` }
                        })
                    ),
                    React.createElement('span', {
                        key: 'count',
                        className: 'text-sm font-semibold text-gray-700 min-w-[30px] text-right'
                    }, item.count),
                    React.createElement('span', {
                        key: 'percent',
                        className: 'text-xs text-gray-500 min-w-[45px] text-right'
                    }, `${percentage.toFixed(1)}%`)
                ])
            ]);
        })),

        // Summary
        React.createElement('div', {
            key: 'summary',
            className: 'pt-3 border-t border-gray-200 flex justify-between items-center text-sm'
        }, [
            React.createElement('span', {
                key: 'total',
                className: 'text-gray-600'
            }, `Total: ${total} incidentes em ${totalItems} categorias`),
            React.createElement('span', {
                key: 'showing',
                className: 'text-gray-500'
            }, totalItems > itemsPerPage ?
                `Mostrando ${startIndex + 1}-${Math.min(endIndex, totalItems)} de ${totalItems}` :
                ''
            )
        ]),

        // Pagination
        totalPages > 1 && React.createElement('div', {
            key: 'pagination',
            className: 'flex justify-center items-center gap-1 mt-4'
        }, [
            // Previous button
            React.createElement('button', {
                key: 'prev',
                onClick: () => handlePageChange(currentPage - 1),
                disabled: currentPage === 1,
                className: `px-3 py-1 text-sm rounded ${
                    currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`
            }, '←'),

            // Page numbers
            ...Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                    pageNum = i + 1;
                } else if (currentPage <= 3) {
                    pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                } else {
                    pageNum = currentPage - 2 + i;
                }

                return React.createElement('button', {
                    key: `page-${pageNum}`,
                    onClick: () => handlePageChange(pageNum),
                    className: `px-3 py-1 text-sm rounded ${
                        pageNum === currentPage
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`
                }, pageNum);
            }),

            // Next button
            React.createElement('button', {
                key: 'next',
                onClick: () => handlePageChange(currentPage + 1),
                disabled: currentPage === totalPages,
                className: `px-3 py-1 text-sm rounded ${
                    currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`
            }, '→')
        ])
    ]);
};