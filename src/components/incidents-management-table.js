// Incidents Management Table with Sorting and Pagination
// Enhanced table component for incidents with full sorting and pagination capabilities
/* global React */

window.IncidentsManagementTable = function ({ incidents, onView, onEdit }) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [sortField, setSortField] = React.useState('id');
  const [sortDirection, setSortDirection] = React.useState('desc');
  const [filter, setFilter] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Filter incidents based on status filter
  const filteredByStatus = React.useMemo(() => {
    if (filter === 'active') {
      return incidents.filter(i => i.status === 'Aberto' || i.status === 'Em Tratamento');
    }
    return incidents;
  }, [incidents, filter]);

  // Search filter
  const filteredBySearch = React.useMemo(() => {
    if (!searchTerm) return filteredByStatus;

    const term = searchTerm.toLowerCase();
    return filteredByStatus.filter(
      incident =>
        incident.id.toString().includes(term) ||
        incident.title.toLowerCase().includes(term) ||
        incident.category?.toLowerCase().includes(term) ||
        incident.assignee?.toLowerCase().includes(term) ||
        incident.status?.toLowerCase().includes(term)
    );
  }, [filteredByStatus, searchTerm]);

  // Sort incidents
  const sortedIncidents = React.useMemo(() => {
    const sorted = [...filteredBySearch];
    sorted.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle numeric ID sorting
      if (sortField === 'id') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      }

      // Handle priority sorting with custom order
      if (sortField === 'priority') {
        const priorityOrder = { Crítica: 4, Alta: 3, Média: 2, Baixa: 1 };
        aValue = priorityOrder[aValue] || 0;
        bValue = priorityOrder[bValue] || 0;
      }

      // Handle status sorting with custom order
      if (sortField === 'status') {
        const statusOrder = { Aberto: 4, 'Em Tratamento': 3, Resolvido: 2, Fechado: 1 };
        aValue = statusOrder[aValue] || 0;
        bValue = statusOrder[bValue] || 0;
      }

      // Convert to strings for comparison if not numbers
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredBySearch, sortField, sortDirection]);

  // Pagination calculations
  const totalItems = sortedIncidents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = sortedIncidents.slice(startIndex, endIndex);

  // Handlers
  const handleSort = field => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageChange = page => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = value => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page
  };

  // Get sort icon
  const getSortIcon = field => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Column configuration
  const columns = [
    { field: 'id', label: 'ID', width: 'w-20' },
    { field: 'title', label: 'Título', width: 'w-64' },
    { field: 'status', label: 'Status', width: 'w-32' },
    { field: 'priority', label: 'Prioridade', width: 'w-28' },
    { field: 'category', label: 'Categoria', width: 'w-40' },
    { field: 'assignee', label: 'Responsável', width: 'w-40' },
  ];

  return React.createElement(
    'div',
    {
      className: 'bg-white rounded-lg shadow',
    },
    [
      // Header with filters
      React.createElement(
        'div',
        {
          key: 'header',
          className: 'p-6 border-b',
        },
        [
          // Title and main actions
          React.createElement(
            'div',
            {
              key: 'title-row',
              className: 'flex justify-between items-center mb-4',
            },
            [
              React.createElement(
                'h2',
                {
                  key: 'title',
                  className: 'text-xl font-bold',
                },
                'Gestão de Incidentes'
              ),
              React.createElement(
                'div',
                {
                  key: 'stats',
                  className: 'text-sm text-gray-600',
                },
                `${totalItems} incidentes encontrados`
              ),
            ]
          ),

          // Filters row
          React.createElement(
            'div',
            {
              key: 'filters',
              className: 'flex flex-wrap gap-4 items-center',
            },
            [
              // Status filter buttons
              React.createElement(
                'div',
                {
                  key: 'status-filter',
                  className: 'flex gap-2',
                },
                [
                  React.createElement(
                    'button',
                    {
                      key: 'active',
                      onClick: () => setFilter('active'),
                      className: `px-4 py-2 rounded transition-colors ${
                        filter === 'active'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`,
                    },
                    'Ativos'
                  ),
                  React.createElement(
                    'button',
                    {
                      key: 'all',
                      onClick: () => setFilter('all'),
                      className: `px-4 py-2 rounded transition-colors ${
                        filter === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`,
                    },
                    'Todos'
                  ),
                ]
              ),

              // Search input
              React.createElement(
                'div',
                {
                  key: 'search',
                  className: 'flex-1 max-w-xs',
                },
                React.createElement('input', {
                  type: 'text',
                  placeholder: 'Buscar incidentes...',
                  value: searchTerm,
                  onChange: e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  },
                  className:
                    'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                })
              ),

              // Items per page selector
              React.createElement(
                'div',
                {
                  key: 'items-per-page',
                  className: 'flex items-center gap-2',
                },
                [
                  React.createElement(
                    'span',
                    {
                      key: 'label',
                      className: 'text-sm text-gray-600',
                    },
                    'Mostrar:'
                  ),
                  React.createElement(
                    'select',
                    {
                      key: 'select',
                      value: itemsPerPage,
                      onChange: e => handleItemsPerPageChange(e.target.value),
                      className: 'text-sm border rounded px-2 py-1',
                    },
                    [
                      React.createElement('option', { key: '5', value: 5 }, '5'),
                      React.createElement('option', { key: '10', value: 10 }, '10'),
                      React.createElement('option', { key: '25', value: 25 }, '25'),
                      React.createElement('option', { key: '50', value: 50 }, '50'),
                      React.createElement('option', { key: '100', value: 100 }, '100'),
                    ]
                  ),
                ]
              ),
            ]
          ),
        ]
      ),

      // Table
      React.createElement(
        'div',
        {
          key: 'table-container',
          className: 'overflow-x-auto',
        },
        React.createElement(
          'table',
          {
            className: 'w-full',
          },
          [
            // Table header with sortable columns
            React.createElement(
              'thead',
              {
                key: 'thead',
                className: 'bg-gray-50',
              },
              React.createElement('tr', {}, [
                ...columns.map(col =>
                  React.createElement(
                    'th',
                    {
                      key: col.field,
                      onClick: () => handleSort(col.field),
                      className: `px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${col.width || ''}`,
                    },
                    [
                      React.createElement('span', { key: 'label' }, col.label),
                      React.createElement(
                        'span',
                        {
                          key: 'icon',
                          className: 'ml-1 text-gray-400',
                        },
                        getSortIcon(col.field)
                      ),
                    ]
                  )
                ),
                React.createElement(
                  'th',
                  {
                    key: 'actions',
                    className:
                      'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                  },
                  'Ações'
                ),
              ])
            ),

            // Table body
            React.createElement(
              'tbody',
              {
                key: 'tbody',
                className: 'bg-white divide-y divide-gray-200',
              },
              currentItems.length > 0
                ? currentItems.map(incident =>
                    React.createElement(
                      'tr',
                      {
                        key: incident.id,
                        className: 'hover:bg-gray-50 transition-colors',
                      },
                      [
                        React.createElement(
                          'td',
                          {
                            key: 'id',
                            className:
                              'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900',
                          },
                          `#${incident.id}`
                        ),
                        React.createElement(
                          'td',
                          {
                            key: 'title',
                            className: 'px-6 py-4 text-sm text-gray-900',
                            title: incident.title,
                          },
                          React.createElement(
                            'div',
                            {
                              className: 'truncate max-w-xs',
                            },
                            incident.title
                          )
                        ),
                        React.createElement(
                          'td',
                          {
                            key: 'status',
                            className: 'px-6 py-4 whitespace-nowrap',
                          },
                          React.createElement(
                            'span',
                            {
                              className: `px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                incident.status === 'Aberto'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : incident.status === 'Em Tratamento'
                                    ? 'bg-blue-100 text-blue-800'
                                    : incident.status === 'Resolvido'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`,
                            },
                            incident.status
                          )
                        ),
                        React.createElement(
                          'td',
                          {
                            key: 'priority',
                            className: 'px-6 py-4 whitespace-nowrap',
                          },
                          React.createElement(
                            'span',
                            {
                              className: `text-sm ${
                                incident.priority === 'Crítica'
                                  ? 'text-red-600 font-bold'
                                  : incident.priority === 'Alta'
                                    ? 'text-orange-600 font-semibold'
                                    : incident.priority === 'Média'
                                      ? 'text-yellow-600'
                                      : 'text-gray-600'
                              }`,
                            },
                            incident.priority
                          )
                        ),
                        React.createElement(
                          'td',
                          {
                            key: 'category',
                            className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500',
                          },
                          incident.category
                        ),
                        React.createElement(
                          'td',
                          {
                            key: 'assignee',
                            className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500',
                          },
                          incident.assignee
                        ),
                        React.createElement(
                          'td',
                          {
                            key: 'actions',
                            className: 'px-6 py-4 whitespace-nowrap text-sm font-medium',
                          },
                          [
                            React.createElement(
                              'button',
                              {
                                key: 'view',
                                onClick: () => onView && onView(incident),
                                className: 'text-blue-600 hover:text-blue-900 mr-3',
                              },
                              'Ver'
                            ),
                            React.createElement(
                              'button',
                              {
                                key: 'edit',
                                onClick: () => onEdit && onEdit(incident),
                                className: 'text-green-600 hover:text-green-900',
                              },
                              'Editar'
                            ),
                          ]
                        ),
                      ]
                    )
                  )
                : React.createElement(
                    'tr',
                    {
                      key: 'no-data',
                    },
                    React.createElement(
                      'td',
                      {
                        colSpan: 7,
                        className: 'px-6 py-8 text-center text-gray-500',
                      },
                      'Nenhum incidente encontrado'
                    )
                  )
            ),
          ]
        )
      ),

      // Footer with pagination
      React.createElement(
        'div',
        {
          key: 'footer',
          className: 'px-6 py-4 border-t flex items-center justify-between',
        },
        [
          // Results info
          React.createElement(
            'div',
            {
              key: 'info',
              className: 'text-sm text-gray-700',
            },
            totalItems > 0
              ? `Mostrando ${startIndex + 1}-${Math.min(endIndex, totalItems)} de ${totalItems} resultados`
              : 'Nenhum resultado'
          ),

          // Pagination controls
          totalPages > 1 &&
            React.createElement(
              'div',
              {
                key: 'pagination',
                className: 'flex items-center gap-2',
              },
              [
                // First page
                React.createElement(
                  'button',
                  {
                    key: 'first',
                    onClick: () => handlePageChange(1),
                    disabled: currentPage === 1,
                    className: `px-3 py-1 text-sm rounded ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`,
                  },
                  '«'
                ),

                // Previous
                React.createElement(
                  'button',
                  {
                    key: 'prev',
                    onClick: () => handlePageChange(currentPage - 1),
                    disabled: currentPage === 1,
                    className: `px-3 py-1 text-sm rounded ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`,
                  },
                  '‹'
                ),

                // Page numbers
                React.createElement(
                  'div',
                  {
                    key: 'pages',
                    className: 'flex items-center gap-1',
                  },
                  (() => {
                    const pages = [];
                    const maxVisible = 5;
                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                    let end = Math.min(totalPages, start + maxVisible - 1);

                    if (end - start < maxVisible - 1) {
                      start = Math.max(1, end - maxVisible + 1);
                    }

                    if (start > 1) {
                      pages.push(
                        React.createElement(
                          'span',
                          {
                            key: 'dots-start',
                            className: 'px-2 text-gray-500',
                          },
                          '...'
                        )
                      );
                    }

                    for (let i = start; i <= end; i++) {
                      pages.push(
                        React.createElement(
                          'button',
                          {
                            key: `page-${i}`,
                            onClick: () => handlePageChange(i),
                            className: `px-3 py-1 text-sm rounded ${
                              i === currentPage
                                ? 'bg-purple-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`,
                          },
                          i
                        )
                      );
                    }

                    if (end < totalPages) {
                      pages.push(
                        React.createElement(
                          'span',
                          {
                            key: 'dots-end',
                            className: 'px-2 text-gray-500',
                          },
                          '...'
                        )
                      );
                    }

                    return pages;
                  })()
                ),

                // Next
                React.createElement(
                  'button',
                  {
                    key: 'next',
                    onClick: () => handlePageChange(currentPage + 1),
                    disabled: currentPage === totalPages,
                    className: `px-3 py-1 text-sm rounded ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`,
                  },
                  '›'
                ),

                // Last page
                React.createElement(
                  'button',
                  {
                    key: 'last',
                    onClick: () => handlePageChange(totalPages),
                    disabled: currentPage === totalPages,
                    className: `px-3 py-1 text-sm rounded ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`,
                  },
                  '»'
                ),
              ]
            ),
        ]
      ),
    ]
  );
};
