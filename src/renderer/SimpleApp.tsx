import React, { useState, useEffect } from 'react';
import { Settings, BarChart3, HelpCircle, Plus, Search, X } from 'lucide-react';

// Simple mock data
const mockIncidents = [
  {
    id: '1',
    title: 'S0C4 ABEND in COBOL Program During Array Processing',
    problem: 'Program terminates with S0C4 protection exception when processing arrays',
    solution: 'Check OCCURS clause and verify array subscript bounds. Increase REGION size.',
    category: 'COBOL',
    tags: ['cobol', 'array', 'abend'],
    status: 'open',
    priority: 'high',
    created: new Date().toISOString()
  },
  {
    id: '2',
    title: 'DB2 SQLCODE -818 Timestamp Mismatch',
    problem: 'Timestamp mismatch between DBRM and plan',
    solution: 'Rebind the package with current DBRM',
    category: 'DB2',
    tags: ['db2', 'sql', 'bind'],
    status: 'resolved',
    priority: 'medium',
    created: new Date().toISOString()
  },
  {
    id: '3',
    title: 'VSAM File Status 93',
    problem: 'Record not available for read',
    solution: 'Check file status and record locks',
    category: 'VSAM',
    tags: ['vsam', 'file', 'io'],
    status: 'open',
    priority: 'low',
    created: new Date().toISOString()
  }
];

// Simple Modal Component
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Simple Form Component
const IncidentForm: React.FC<{
  incident?: any;
  onSave: (incident: any) => void;
  onCancel: () => void;
}> = ({ incident, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: incident?.title || '',
    problem: incident?.problem || '',
    solution: incident?.solution || '',
    category: incident?.category || 'COBOL',
    priority: incident?.priority || 'medium',
    tags: incident?.tags?.join(', ') || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...incident,
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      id: incident?.id || Date.now().toString(),
      created: incident?.created || new Date().toISOString(),
      status: incident?.status || 'open'
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Problem Description</label>
        <textarea
          value={formData.problem}
          onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Solution</label>
        <textarea
          value={formData.solution}
          onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="COBOL">COBOL</option>
            <option value="DB2">DB2</option>
            <option value="VSAM">VSAM</option>
            <option value="JCL">JCL</option>
            <option value="CICS">CICS</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g., cobol, array, memory"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          {incident ? 'Update' : 'Create'} Incident
        </button>
      </div>
    </form>
  );
};

// Main App Component
const SimpleApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'incidents' | 'settings'>('dashboard');
  const [incidents, setIncidents] = useState(mockIncidents);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [filteredIncidents, setFilteredIncidents] = useState(mockIncidents);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredIncidents(incidents);
    } else {
      const filtered = incidents.filter(incident =>
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.solution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredIncidents(filtered);
    }
  }, [searchQuery, incidents]);

  const handleCreateIncident = (incidentData: any) => {
    setIncidents([...incidents, incidentData]);
    setShowCreateModal(false);
  };

  const handleUpdateIncident = (updatedIncident: any) => {
    setIncidents(incidents.map(inc =>
      inc.id === updatedIncident.id ? updatedIncident : inc
    ));
    setShowEditModal(false);
    setSelectedIncident(null);
  };

  const handleEditIncident = (incident: any) => {
    setSelectedIncident(incident);
    setShowEditModal(true);
  };

  const handleDeleteIncident = (incidentId: string) => {
    if (confirm('Are you sure you want to delete this incident?')) {
      setIncidents(incidents.filter(inc => inc.id !== incidentId));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-600 bg-red-100';
      case 'in_progress': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'COBOL': return 'bg-blue-100 text-blue-800';
      case 'DB2': return 'bg-green-100 text-green-800';
      case 'VSAM': return 'bg-yellow-100 text-yellow-800';
      case 'JCL': return 'bg-purple-100 text-purple-800';
      case 'CICS': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold">🏢</div>
              <div>
                <h1 className="text-2xl font-bold">Mainframe AI Assistant</h1>
                <p className="text-purple-100">Incident Management System</p>
              </div>
            </div>

            <nav className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  currentView === 'dashboard' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setCurrentView('incidents')}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  currentView === 'incidents' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <span>🚨</span>
                <span>Incidents</span>
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  currentView === 'settings' ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'dashboard' && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center">
                  <div className="text-3xl">📋</div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                    <p className="text-2xl font-bold text-gray-900">{incidents.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center">
                  <div className="text-3xl">✅</div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Resolved</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {incidents.filter(i => i.status === 'resolved').length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center">
                  <div className="text-3xl">🔥</div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">High Priority</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {incidents.filter(i => i.priority === 'high' || i.priority === 'critical').length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center">
                  <div className="text-3xl">📈</div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold text-gray-900">87%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <Plus className="w-5 h-5 mr-3" />
                    <div>
                      <div className="font-semibold">Report New Incident</div>
                      <div className="text-sm text-red-100">Submit a new mainframe issue</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setCurrentView('incidents')}
                  className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-3" />
                    <div>
                      <div className="font-semibold">View All Incidents</div>
                      <div className="text-sm text-blue-100">Browse and manage incidents</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Incidents */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Incidents ({filteredIncidents.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIncidents.slice(0, 6).map((incident) => (
                  <div key={incident.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getCategoryColor(incident.category)}`}>
                        {incident.category}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(incident.status)}`}>
                        {incident.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm line-clamp-2">
                      {incident.title}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {incident.problem}
                    </p>
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEditIncident(incident)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteIncident(incident.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        incident.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        incident.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        incident.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {incident.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'incidents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">All Incidents</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Incident</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Incidents List */}
            <div className="bg-white rounded-xl shadow-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Incident
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{incident.title}</div>
                            <div className="text-sm text-gray-500 line-clamp-1">{incident.problem}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getCategoryColor(incident.category)}`}>
                            {incident.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            incident.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            incident.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            incident.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {incident.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(incident.status)}`}>
                            {incident.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleEditIncident(incident)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteIncident(incident.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Settings</h3>
              <p className="text-gray-600">Settings functionality will be implemented here.</p>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Incident"
      >
        <IncidentForm
          onSave={handleCreateIncident}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedIncident(null);
        }}
        title="Edit Incident"
      >
        <IncidentForm
          incident={selectedIncident}
          onSave={handleUpdateIncident}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedIncident(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default SimpleApp;