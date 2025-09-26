// Menu Modals Components for Mainframe AI Assistant
// All modal components for dropdown menu options

// Profile Modal - User Information
window.ProfileModal = function ({ isOpen, onClose, user }) {
  if (!isOpen) return null;

  const [profileData, setProfileData] = React.useState({
    username: user?.username || '',
    display_name: user?.display_name || '',
    email: user?.email || '',
    computer: user?.computer || '',
    domain: user?.domain || '',
    role: user?.role || 'user',
  });

  const handleSave = async () => {
    try {
      // Update user data in database
      const response = await fetch(`http://localhost:3001/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        // Update localStorage with new data
        const updatedUser = { ...user, ...profileData };
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        window.currentUser = updatedUser;

        // Also save to settings in database for persistence
        // Remove email from the data being sent (email cannot be changed)
        const { email, ...profileDataWithoutEmail } = profileData;
        await fetch(`http://localhost:3001/api/settings/${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: profileData.display_name,
            // email is intentionally excluded - it cannot be changed
            userData: profileDataWithoutEmail,
          }),
        });

        onClose();

        // Show success message
        const toast = document.createElement('div');
        toast.className =
          'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
        toast.textContent = 'Perfil atualizado com sucesso!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              '👤 Informações Pessoais'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Form
        React.createElement(
          'div',
          {
            key: 'form',
            className: 'space-y-4',
          },
          [
            // Username
            React.createElement('div', { key: 'username-field' }, [
              React.createElement(
                'label',
                { className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Nome de Usuário'
              ),
              React.createElement('input', {
                type: 'text',
                value: profileData.username,
                onChange: e => setProfileData({ ...profileData, username: e.target.value }),
                className: 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
                disabled: true,
              }),
            ]),

            // Display Name
            React.createElement('div', { key: 'display-field' }, [
              React.createElement(
                'label',
                { className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Nome Completo'
              ),
              React.createElement('input', {
                type: 'text',
                value: profileData.display_name,
                onChange: e => setProfileData({ ...profileData, display_name: e.target.value }),
                className: 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
              }),
            ]),

            // Email (read-only - cannot be changed after SSO login)
            React.createElement('div', { key: 'email-field' }, [
              React.createElement(
                'label',
                { className: 'block text-sm font-medium text-gray-700 mb-1' },
                'Email (não editável - usado para autenticação SSO)'
              ),
              React.createElement('input', {
                type: 'email',
                value: profileData.email,
                readOnly: true,
                disabled: true,
                className: 'w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed',
                title: 'O email não pode ser alterado pois é usado para identificação no SSO',
              }),
            ]),

            // Computer Info (read-only)
            React.createElement('div', { key: 'info', className: 'grid grid-cols-2 gap-4' }, [
              React.createElement('div', { key: 'computer' }, [
                React.createElement(
                  'label',
                  { className: 'block text-sm font-medium text-gray-700 mb-1' },
                  'Computador'
                ),
                React.createElement('input', {
                  type: 'text',
                  value: profileData.computer,
                  className: 'w-full px-4 py-2 border rounded-lg bg-gray-50',
                  disabled: true,
                }),
              ]),
              React.createElement('div', { key: 'domain' }, [
                React.createElement(
                  'label',
                  { className: 'block text-sm font-medium text-gray-700 mb-1' },
                  'Domínio'
                ),
                React.createElement('input', {
                  type: 'text',
                  value: profileData.domain,
                  className: 'w-full px-4 py-2 border rounded-lg bg-gray-50',
                  disabled: true,
                }),
              ]),
            ]),
          ]
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-end gap-3 mt-6 pt-4 border-t',
          },
          [
            React.createElement(
              'button',
              {
                key: 'cancel',
                onClick: onClose,
                className: 'px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg',
              },
              'Cancelar'
            ),
            React.createElement(
              'button',
              {
                key: 'save',
                onClick: handleSave,
                className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
              },
              'Salvar'
            ),
          ]
        ),
      ]
    )
  );
};

// Notifications Modal
window.NotificationsModal = function ({ isOpen, onClose, user, userId }) {
  if (!isOpen) return null;

  // Support both user prop (from index.html) and direct userId prop
  const effectiveUserId = userId || (user && user.id);

  const [notifSettings, setNotifSettings] = React.useState({
    email: true,
    desktop: true,
    sound: true,
    incident_updates: true,
    system_alerts: true,
    mentions: true,
  });

  React.useEffect(() => {
    if (isOpen && effectiveUserId) {
      // Load notification settings
      fetch(`http://localhost:3001/api/settings/${effectiveUserId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.settings && data.settings.notifications) {
            setNotifSettings(data.settings.notifications);
          }
        })
        .catch(err => console.error('Error loading notifications:', err));
    }
  }, [isOpen, effectiveUserId]);

  const handleSave = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${effectiveUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: notifSettings }),
      });

      if (response.ok) {
        // Show success message
        const toast = document.createElement('div');
        toast.className =
          'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
        toast.textContent = 'Notificações atualizadas com sucesso!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
      onClose();
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              '🔔 Notificações'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Notification options
        React.createElement(
          'div',
          {
            key: 'options',
            className: 'space-y-4',
          },
          [
            { id: 'email', label: 'Notificações por Email', desc: 'Receber alertas por email' },
            { id: 'desktop', label: 'Notificações Desktop', desc: 'Notificações do navegador' },
            { id: 'sound', label: 'Sons de Alerta', desc: 'Tocar sons para alertas' },
            {
              id: 'incident_updates',
              label: 'Atualizações de Incidentes',
              desc: 'Mudanças em incidentes',
            },
            {
              id: 'system_alerts',
              label: 'Alertas do Sistema',
              desc: 'Alertas de sistema críticos',
            },
            { id: 'mentions', label: 'Menções', desc: 'Quando você é mencionado' },
          ].map(option =>
            React.createElement(
              'div',
              {
                key: option.id,
                className: 'flex items-center justify-between p-4 bg-gray-50 rounded-lg',
              },
              [
                React.createElement('div', { key: 'info' }, [
                  React.createElement('div', { className: 'font-medium' }, option.label),
                  React.createElement('div', { className: 'text-sm text-gray-500' }, option.desc),
                ]),
                React.createElement('input', {
                  key: 'toggle',
                  type: 'checkbox',
                  checked: notifSettings[option.id],
                  onChange: e =>
                    setNotifSettings({
                      ...notifSettings,
                      [option.id]: e.target.checked,
                    }),
                  className: 'w-5 h-5',
                }),
              ]
            )
          )
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-end gap-3 mt-6 pt-4 border-t',
          },
          [
            React.createElement(
              'button',
              {
                key: 'cancel',
                onClick: onClose,
                className: 'px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg',
              },
              'Cancelar'
            ),
            React.createElement(
              'button',
              {
                key: 'save',
                onClick: handleSave,
                className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
              },
              'Salvar'
            ),
          ]
        ),
      ]
    )
  );
};

// Active Sessions Modal
window.SessionsModal = function ({ isOpen, onClose, user, userId }) {
  if (!isOpen) return null;

  // Support both user prop (from index.html) and direct userId prop
  const effectiveUserId = userId || (user && user.id);

  const [sessions, setSessions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen && effectiveUserId) {
      setLoading(true);
      fetch(`http://localhost:3001/api/sessions/${effectiveUserId}`)
        .then(res => res.json())
        .then(data => {
          setSessions(data.sessions || []);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading sessions:', err);
          setLoading(false);
        });
    }
  }, [isOpen, effectiveUserId]);

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              '📱 Sessões Ativas'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Sessions list
        React.createElement(
          'div',
          {
            key: 'sessions',
            className: 'space-y-3 max-h-96 overflow-y-auto',
          },
          loading
            ? React.createElement(
                'div',
                { className: 'text-center py-8 text-gray-500' },
                'Carregando sessões...'
              )
            : sessions.length === 0
              ? React.createElement(
                  'div',
                  { className: 'text-center py-8 text-gray-500' },
                  'Nenhuma sessão ativa encontrada'
                )
              : sessions.map(session =>
                  React.createElement(
                    'div',
                    {
                      key: session.session_id,
                      className: 'p-4 border rounded-lg hover:bg-gray-50',
                    },
                    [
                      React.createElement(
                        'div',
                        {
                          key: 'info',
                          className: 'flex justify-between items-start',
                        },
                        [
                          React.createElement('div', { key: 'details' }, [
                            React.createElement(
                              'div',
                              { className: 'font-medium' },
                              session.ip_address
                            ),
                            React.createElement(
                              'div',
                              { className: 'text-sm text-gray-500' },
                              session.user_agent
                            ),
                            React.createElement(
                              'div',
                              { className: 'text-xs text-gray-400 mt-1' },
                              `Criada: ${new Date(session.created_at).toLocaleString('pt-BR')}`
                            ),
                            React.createElement(
                              'div',
                              { className: 'text-xs text-gray-400' },
                              `Expira: ${new Date(session.expires_at).toLocaleString('pt-BR')}`
                            ),
                          ]),
                          React.createElement(
                            'span',
                            {
                              key: 'status',
                              className: `px-2 py-1 text-xs rounded ${
                                session.is_active
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-600'
                              }`,
                            },
                            session.is_active ? 'Ativa' : 'Inativa'
                          ),
                        ]
                      ),
                    ]
                  )
                )
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-end mt-6 pt-4 border-t',
          },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            },
            'Fechar'
          )
        ),
      ]
    )
  );
};

// System Logs Modal
window.SystemLogsModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [logs, setLogs] = React.useState([]);
  const [filter, setFilter] = React.useState('all');

  React.useEffect(() => {
    if (isOpen) {
      // Load system logs
      fetch('http://localhost:3001/api/logs')
        .then(res => res.json())
        .then(data => setLogs(data.logs || []))
        .catch(err => console.error('Error loading logs:', err));
    }
  }, [isOpen]);

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              '📋 Logs do Sistema'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Filter
        React.createElement(
          'div',
          {
            key: 'filter',
            className: 'flex gap-2 mb-4',
          },
          [
            { value: 'all', label: 'Todos', color: 'gray' },
            { value: 'info', label: 'Info', color: 'blue' },
            { value: 'warning', label: 'Aviso', color: 'yellow' },
            { value: 'error', label: 'Erro', color: 'red' },
          ].map(option =>
            React.createElement(
              'button',
              {
                key: option.value,
                onClick: () => setFilter(option.value),
                className: `px-3 py-1 rounded-lg ${
                  filter === option.value
                    ? `bg-${option.color}-500 text-white`
                    : 'bg-gray-200 hover:bg-gray-300'
                }`,
              },
              option.label
            )
          )
        ),

        // Logs
        React.createElement(
          'div',
          {
            key: 'logs',
            className:
              'bg-gray-900 text-gray-100 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm',
          },
          filteredLogs.map((log, i) =>
            React.createElement(
              'div',
              {
                key: i,
                className: 'mb-2',
              },
              `[${log.timestamp}] [${log.level}] ${log.message}`
            )
          )
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-end mt-6 pt-4 border-t',
          },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            },
            'Fechar'
          )
        ),
      ]
    )
  );
};

// About Modal
window.AboutModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              'ℹ️ Sobre'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Content
        React.createElement(
          'div',
          {
            key: 'content',
            className: 'space-y-4',
          },
          [
            React.createElement(
              'div',
              {
                key: 'logo',
                className: 'text-center mb-6',
              },
              [
                React.createElement('div', { className: 'text-4xl mb-2' }, '🖥️'),
                React.createElement(
                  'h3',
                  { className: 'text-xl font-bold' },
                  'Accenture Mainframe AI Assistant'
                ),
                React.createElement(
                  'p',
                  { className: 'text-sm text-gray-500' },
                  'Sistema de Gestão de Incidentes com IA'
                ),
              ]
            ),

            React.createElement('div', { key: 'info', className: 'space-y-2' }, [
              React.createElement('div', { className: 'flex justify-between py-2 border-b' }, [
                React.createElement('span', { className: 'font-medium' }, 'Versão:'),
                React.createElement('span', {}, '2.0.0'),
              ]),
              React.createElement('div', { className: 'flex justify-between py-2 border-b' }, [
                React.createElement('span', { className: 'font-medium' }, 'Build:'),
                React.createElement('span', {}, '2025.09.24'),
              ]),
              React.createElement('div', { className: 'flex justify-between py-2 border-b' }, [
                React.createElement('span', { className: 'font-medium' }, 'Ambiente:'),
                React.createElement('span', {}, 'Produção'),
              ]),
              React.createElement('div', { className: 'flex justify-between py-2' }, [
                React.createElement('span', { className: 'font-medium' }, 'Desenvolvido por:'),
                React.createElement('span', {}, 'Accenture Technology'),
              ]),
            ]),

            React.createElement(
              'div',
              {
                key: 'tech',
                className: 'mt-6 p-4 bg-gray-50 rounded-lg',
              },
              [
                React.createElement('h4', { className: 'font-medium mb-2' }, 'Tecnologias:'),
                React.createElement(
                  'div',
                  { className: 'flex flex-wrap gap-2' },
                  ['React', 'PostgreSQL', 'Node.js', 'Express', 'Tailwind CSS', 'Claude AI'].map(
                    tech =>
                      React.createElement(
                        'span',
                        {
                          key: tech,
                          className: 'px-2 py-1 bg-blue-100 text-blue-600 rounded text-sm',
                        },
                        tech
                      )
                  )
                ),
              ]
            ),
          ]
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-center mt-6 pt-4 border-t',
          },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
            },
            'OK'
          )
        ),
      ]
    )
  );
};

// Performance Modal
window.PerformanceModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '⚡ Desempenho'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4' },
          React.createElement(
            'p',
            { className: 'text-gray-600' },
            'Métricas de desempenho do sistema...'
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-center mt-6 pt-4 border-t' },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            },
            'Fechar'
          )
        ),
      ]
    )
  );
};

// Privacy Modal
window.PrivacyModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '🛡️ Política de Privacidade'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4 max-h-96 overflow-y-auto' },
          React.createElement(
            'p',
            { className: 'text-gray-600' },
            'Nossa política de privacidade...'
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-center mt-6 pt-4 border-t' },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
            },
            'Aceitar'
          )
        ),
      ]
    )
  );
};

// Terms Modal
window.TermsModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '📄 Termos de Uso'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4 max-h-96 overflow-y-auto' },
          React.createElement('p', { className: 'text-gray-600' }, 'Termos e condições de uso...')
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-center mt-6 pt-4 border-t' },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
            },
            'Aceitar'
          )
        ),
      ]
    )
  );
};

// Licenses Modal
window.LicensesModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '📜 Licenças'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4 max-h-96 overflow-y-auto' },
          React.createElement(
            'p',
            { className: 'text-gray-600' },
            'Licenças de software de terceiros...'
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-center mt-6 pt-4 border-t' },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            },
            'Fechar'
          )
        ),
      ]
    )
  );
};

// Language Modal
window.LanguageModal = function ({ isOpen, onClose, userId }) {
  if (!isOpen) return null;

  const [selectedLang, setSelectedLang] = React.useState('pt');
  const [loading, setLoading] = React.useState(false);

  // Load current language from database on open
  React.useEffect(() => {
    if (isOpen && userId) {
      fetch(`http://localhost:3001/api/settings/${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.settings) {
            setSelectedLang(data.settings.language || 'pt');
          }
        })
        .catch(err => console.error('Error loading language:', err));
    }
  }, [isOpen, userId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: selectedLang }),
      });

      if (response.ok) {
        document.documentElement.lang = selectedLang;
        // Keep localStorage as backup
        localStorage.setItem('language', selectedLang);

        // Show success message
        const toast = document.createElement('div');
        toast.className =
          'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
        toast.textContent = 'Idioma atualizado com sucesso!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

        onClose();
      }
    } catch (error) {
      console.error('Error saving language:', error);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-md p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '🌍 Idioma'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-2' },
          [
            { code: 'pt', label: '🇧🇷 Português', desc: 'Português (Brasil)' },
            { code: 'en', label: '🇺🇸 English', desc: 'English (US)' },
            { code: 'es', label: '🇪🇸 Español', desc: 'Español' },
          ].map(lang =>
            React.createElement(
              'button',
              {
                key: lang.code,
                onClick: () => setSelectedLang(lang.code),
                className: `w-full p-3 rounded-lg flex items-center gap-3 ${selectedLang === lang.code ? 'bg-blue-50 border-2 border-blue-500' : 'hover:bg-gray-50 border-2 border-transparent'}`,
              },
              [
                React.createElement(
                  'span',
                  { key: 'icon', className: 'text-2xl' },
                  lang.label.split(' ')[0]
                ),
                React.createElement('div', { key: 'text', className: 'text-left' }, [
                  React.createElement(
                    'div',
                    { className: 'font-medium' },
                    lang.label.split(' ')[1]
                  ),
                  React.createElement('div', { className: 'text-sm text-gray-500' }, lang.desc),
                ]),
              ]
            )
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-end gap-3 mt-6 pt-4 border-t' },
          [
            React.createElement(
              'button',
              {
                key: 'cancel',
                onClick: onClose,
                className: 'px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg',
              },
              'Cancelar'
            ),
            React.createElement(
              'button',
              {
                key: 'save',
                onClick: handleSave,
                className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
              },
              'Salvar'
            ),
          ]
        ),
      ]
    )
  );
};

// Theme Modal
window.ThemeModal = function ({ isOpen, onClose, userId }) {
  if (!isOpen) return null;

  const [selectedTheme, setSelectedTheme] = React.useState('light');
  const [loading, setLoading] = React.useState(false);

  // Load current theme from database on open
  React.useEffect(() => {
    if (isOpen && userId) {
      fetch(`http://localhost:3001/api/settings/${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.settings) {
            setSelectedTheme(data.settings.theme || 'light');
          }
        })
        .catch(err => console.error('Error loading theme:', err));
    }
  }, [isOpen, userId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/settings/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedTheme }),
      });

      if (response.ok) {
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(selectedTheme);
        // Keep localStorage as backup
        localStorage.setItem('theme', selectedTheme);

        // Show success message
        const toast = document.createElement('div');
        toast.className =
          'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 fade-in';
        toast.textContent = 'Tema atualizado com sucesso!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

        onClose();
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-md p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '🎨 Tema'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-2' },
          [
            { value: 'light', label: '☀️ Claro', desc: 'Tema claro' },
            { value: 'dark', label: '🌙 Escuro', desc: 'Tema escuro' },
            { value: 'auto', label: '🔄 Automático', desc: 'Seguir sistema' },
          ].map(theme =>
            React.createElement(
              'button',
              {
                key: theme.value,
                onClick: () => setSelectedTheme(theme.value),
                className: `w-full p-3 rounded-lg flex items-center gap-3 ${selectedTheme === theme.value ? 'bg-blue-50 border-2 border-blue-500' : 'hover:bg-gray-50 border-2 border-transparent'}`,
              },
              [
                React.createElement(
                  'span',
                  { key: 'icon', className: 'text-2xl' },
                  theme.label.split(' ')[0]
                ),
                React.createElement('div', { key: 'text', className: 'text-left' }, [
                  React.createElement(
                    'div',
                    { className: 'font-medium' },
                    theme.label.split(' ')[1]
                  ),
                  React.createElement('div', { className: 'text-sm text-gray-500' }, theme.desc),
                ]),
              ]
            )
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-end gap-3 mt-6 pt-4 border-t' },
          [
            React.createElement(
              'button',
              {
                key: 'cancel',
                onClick: onClose,
                className: 'px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg',
              },
              'Cancelar'
            ),
            React.createElement(
              'button',
              {
                key: 'save',
                onClick: handleSave,
                className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
              },
              'Salvar'
            ),
          ]
        ),
      ]
    )
  );
};

// Shortcuts Config Modal
window.ShortcutsConfigModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '⌨️ Configurar Atalhos'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4' },
          React.createElement(
            'p',
            { className: 'text-gray-600' },
            'Configuração de atalhos de teclado...'
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-center mt-6 pt-4 border-t' },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            },
            'Fechar'
          )
        ),
      ]
    )
  );
};

// Tutorial Modal
window.TutorialModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 fade-in',
      },
      [
        React.createElement(
          'div',
          { key: 'header', className: 'flex justify-between items-center mb-6' },
          [
            React.createElement(
              'h2',
              { key: 'title', className: 'text-2xl font-bold text-gray-800' },
              '🎓 Tutorial Interativo'
            ),
            React.createElement(
              'button',
              { key: 'close', onClick: onClose, className: 'p-2 hover:bg-gray-100 rounded-lg' },
              '✕'
            ),
          ]
        ),
        React.createElement(
          'div',
          { key: 'content', className: 'space-y-4' },
          React.createElement(
            'p',
            { className: 'text-gray-600' },
            'Tutorial passo a passo do sistema...'
          )
        ),
        React.createElement(
          'div',
          { key: 'footer', className: 'flex justify-center mt-6 pt-4 border-t' },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
            },
            'Começar'
          )
        ),
      ]
    )
  );
};

// SSO Modal
window.SSOModal = function ({ isOpen, onClose, user }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              '🔐 Windows SSO'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Content
        React.createElement(
          'div',
          {
            key: 'content',
            className: 'space-y-4',
          },
          [
            // Status
            React.createElement(
              'div',
              {
                key: 'status',
                className: 'bg-green-50 border border-green-200 rounded-lg p-4',
              },
              [
                React.createElement('div', { className: 'flex items-center gap-3' }, [
                  React.createElement('span', { className: 'text-2xl' }, '✅'),
                  React.createElement('div', {}, [
                    React.createElement(
                      'p',
                      { className: 'font-semibold text-green-800' },
                      'SSO Ativo'
                    ),
                    React.createElement(
                      'p',
                      { className: 'text-sm text-green-600' },
                      `Conectado como: ${user?.username || 'Usuário'}`
                    ),
                  ]),
                ]),
              ]
            ),

            // Session info
            React.createElement('div', { key: 'info' }, [
              React.createElement(
                'h3',
                { className: 'font-semibold text-gray-700 mb-2' },
                'Informações da Sessão'
              ),
              React.createElement('div', { className: 'bg-gray-50 rounded-lg p-4 space-y-2' }, [
                React.createElement('div', { className: 'flex justify-between' }, [
                  React.createElement('span', { className: 'text-sm text-gray-600' }, 'Domínio:'),
                  React.createElement(
                    'span',
                    { className: 'text-sm font-medium' },
                    user?.domain || 'ACCENTURE'
                  ),
                ]),
                React.createElement('div', { className: 'flex justify-between' }, [
                  React.createElement(
                    'span',
                    { className: 'text-sm text-gray-600' },
                    'Computador:'
                  ),
                  React.createElement(
                    'span',
                    { className: 'text-sm font-medium' },
                    user?.computer || 'WORKSTATION'
                  ),
                ]),
                React.createElement('div', { className: 'flex justify-between' }, [
                  React.createElement(
                    'span',
                    { className: 'text-sm text-gray-600' },
                    'Último login:'
                  ),
                  React.createElement(
                    'span',
                    { className: 'text-sm font-medium' },
                    new Date().toLocaleString('pt-BR')
                  ),
                ]),
              ]),
            ]),

            // Note
            React.createElement(
              'div',
              {
                key: 'note',
                className: 'border-t pt-4',
              },
              React.createElement(
                'p',
                { className: 'text-xs text-gray-500' },
                'A autenticação é gerenciada automaticamente através do Windows Active Directory.'
              )
            ),
          ]
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-center mt-6 pt-4 border-t',
          },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700',
            },
            'OK'
          )
        ),
      ]
    )
  );
};

// Help Modal
window.HelpModal = function ({ isOpen, onClose }) {
  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    },
    React.createElement(
      'div',
      {
        className: 'bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 fade-in',
      },
      [
        // Header
        React.createElement(
          'div',
          {
            key: 'header',
            className: 'flex justify-between items-center mb-6',
          },
          [
            React.createElement(
              'h2',
              {
                key: 'title',
                className: 'text-2xl font-bold text-gray-800',
              },
              '❓ Ajuda'
            ),
            React.createElement(
              'button',
              {
                key: 'close',
                onClick: onClose,
                className: 'p-2 hover:bg-gray-100 rounded-lg',
              },
              '✕'
            ),
          ]
        ),

        // Content
        React.createElement(
          'div',
          {
            key: 'content',
            className: 'space-y-4',
          },
          [
            React.createElement('div', { key: 'shortcuts' }, [
              React.createElement('h3', { className: 'font-bold mb-2' }, '⌨️ Atalhos de Teclado'),
              React.createElement(
                'div',
                { className: 'space-y-2 p-4 bg-gray-50 rounded-lg' },
                [
                  { keys: 'Ctrl+K', desc: 'Pesquisa rápida' },
                  { keys: 'Ctrl+N', desc: 'Novo incidente' },
                  { keys: 'Ctrl+,', desc: 'Configurações' },
                  { keys: 'F1', desc: 'Ajuda' },
                  { keys: 'Esc', desc: 'Fechar modal' },
                ].map(shortcut =>
                  React.createElement(
                    'div',
                    {
                      key: shortcut.keys,
                      className: 'flex justify-between',
                    },
                    [
                      React.createElement(
                        'kbd',
                        {
                          className: 'px-2 py-1 bg-gray-200 rounded text-sm font-mono',
                        },
                        shortcut.keys
                      ),
                      React.createElement('span', {}, shortcut.desc),
                    ]
                  )
                )
              ),
            ]),

            React.createElement('div', { key: 'links' }, [
              React.createElement('h3', { className: 'font-bold mb-2' }, '📚 Recursos'),
              React.createElement('div', { className: 'space-y-2' }, [
                React.createElement(
                  'a',
                  {
                    href: '#',
                    className: 'block p-3 bg-blue-50 rounded-lg hover:bg-blue-100',
                  },
                  '📖 Documentação Completa'
                ),
                React.createElement(
                  'a',
                  {
                    href: '#',
                    className: 'block p-3 bg-green-50 rounded-lg hover:bg-green-100',
                  },
                  '🎓 Tutorial Interativo'
                ),
                React.createElement(
                  'a',
                  {
                    href: '#',
                    className: 'block p-3 bg-purple-50 rounded-lg hover:bg-purple-100',
                  },
                  '💬 Suporte Técnico'
                ),
              ]),
            ]),
          ]
        ),

        // Footer
        React.createElement(
          'div',
          {
            key: 'footer',
            className: 'flex justify-center mt-6 pt-4 border-t',
          },
          React.createElement(
            'button',
            {
              onClick: onClose,
              className: 'px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300',
            },
            'Fechar'
          )
        ),
      ]
    )
  );
};
