import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, AlertTriangle, Trash2, Archive, Loader2, Info, CheckCircle, XCircle, Clock, FileText, Tag } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose
} from '../ui/Modal';
import { KBEntry } from '../../../backend/core/interfaces/ServiceInterfaces';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  entry?: KBEntry;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onArchiveInstead?: () => Promise<void>;
  loading?: boolean;
  archiving?: boolean;
  variant?: 'delete' | 'archive';
}

interface RelatedData {
  searchReferences: number;
  userBookmarks: number;
  linkedEntries: number;
  recentUsage: number;
}

interface ImpactAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: string[];
  recommendations: string[];
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  entry,
  onClose,
  onConfirm,
  onArchiveInstead,
  loading = false,
  archiving = false,
  variant = 'delete'
}) => {
  // State
  const [confirmationInput, setConfirmationInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [step, setStep] = useState<'warning' | 'confirmation' | 'impact'>('warning');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedData, setRelatedData] = useState<RelatedData | null>(null);
  const [impactAssessment, setImpactAssessment] = useState<ImpactAssessment | null>(null);

  // Refs
  const confirmInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmationInput('');
      setShowDetails(false);
      setStep('warning');
      setIsSubmitting(false);
      loadRelatedData();
    }
  }, [isOpen]);

  // Focus confirmation input when step changes
  useEffect(() => {
    if (step === 'confirmation' && confirmInputRef.current) {
      confirmInputRef.current.focus();
    }
  }, [step]);

  // Mock function to load related data (would come from IPC in real implementation)
  const loadRelatedData = useCallback(async () => {
    if (!entry) return;

    // Simulate loading related data
    setTimeout(() => {
      const mockData: RelatedData = {
        searchReferences: Math.floor(Math.random() * 20) + 1,
        userBookmarks: Math.floor(Math.random() * 15),
        linkedEntries: Math.floor(Math.random() * 8),
        recentUsage: entry.usage_count > 0 ? Math.floor(Math.random() * 10) : 0
      };

      setRelatedData(mockData);
      setImpactAssessment(calculateImpactAssessment(entry, mockData));
    }, 500);
  }, [entry]);

  // Calculate impact assessment
  const calculateImpactAssessment = useCallback((entry: KBEntry, related: RelatedData): ImpactAssessment => {
    let score = 0;
    const factors: string[] = [];
    const recommendations: string[] = [];

    // Usage-based scoring
    if (entry.usage_count > 50) {
      score += 30;
      factors.push('High usage count (50+ views)');
    } else if (entry.usage_count > 20) {
      score += 20;
      factors.push('Moderate usage count (20+ views)');
    } else if (entry.usage_count > 5) {
      score += 10;
      factors.push('Some usage activity');
    }

    // Success rate scoring
    const successRate = entry.usage_count > 0 ? (entry.success_count / entry.usage_count) * 100 : 0;
    if (successRate > 80) {
      score += 25;
      factors.push('High success rate (80%+)');
    } else if (successRate > 60) {
      score += 15;
      factors.push('Good success rate (60%+)');
    }

    // Recent activity
    const daysSinceUpdate = Math.floor((Date.now() - new Date(entry.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate < 30) {
      score += 15;
      factors.push('Recently updated (< 30 days)');
    } else if (daysSinceUpdate < 90) {
      score += 10;
      factors.push('Updated within 3 months');
    }

    // Category importance
    if (['DB2', 'CICS', 'JCL'].includes(entry.category)) {
      score += 20;
      factors.push('Critical system category');
    }

    // Severity
    if (entry.severity === 'critical') {
      score += 25;
      factors.push('Critical severity level');
    } else if (entry.severity === 'high') {
      score += 15;
      factors.push('High severity level');
    }

    // Related data impact
    if (related.searchReferences > 10) {
      score += 15;
      factors.push('Frequently referenced in searches');
    }

    if (related.userBookmarks > 5) {
      score += 10;
      factors.push('Bookmarked by multiple users');
    }

    if (related.linkedEntries > 3) {
      score += 10;
      factors.push('Referenced by other entries');
    }

    // Generate recommendations
    if (score > 70) {
      recommendations.push('Consider archiving instead of deletion');
      recommendations.push('Create backup or export before deletion');
      recommendations.push('Notify stakeholders of deletion');
    } else if (score > 40) {
      recommendations.push('Review entry for potential improvements');
      recommendations.push('Consider archiving for future reference');
    } else {
      recommendations.push('Safe to delete - minimal impact expected');
    }

    // Determine level
    let level: ImpactAssessment['level'];
    if (score >= 80) level = 'critical';
    else if (score >= 60) level = 'high';
    else if (score >= 30) level = 'medium';
    else level = 'low';

    return { level, score, factors, recommendations };
  }, []);

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (!entry) return;

    // For high-impact entries, require typing the title
    if (impactAssessment?.level === 'high' || impactAssessment?.level === 'critical') {
      if (step === 'warning') {
        setStep('impact');
        return;
      }
      if (step === 'impact') {
        setStep('confirmation');
        return;
      }
      if (step === 'confirmation' && confirmationInput.toLowerCase() !== entry.title.toLowerCase()) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error during deletion:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [entry, impactAssessment, step, confirmationInput, onConfirm, onClose]);

  // Handle archive instead
  const handleArchiveInstead = useCallback(async () => {
    if (!onArchiveInstead) return;

    setIsSubmitting(true);

    try {
      await onArchiveInstead();
      onClose();
    } catch (error) {
      console.error('Error during archiving:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [onArchiveInstead, onClose]);

  if (!entry) return null;

  const isHighImpact = impactAssessment?.level === 'high' || impactAssessment?.level === 'critical';
  const canProceed = !isHighImpact || step === 'warning' ||
    (step === 'confirmation' && confirmationInput.toLowerCase() === entry.title.toLowerCase());

  const getImpactColor = (level: ImpactAssessment['level']) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStepIcon = (currentStep: string) => {
    if (currentStep === 'warning') return AlertTriangle;
    if (currentStep === 'impact') return Info;
    if (currentStep === 'confirmation') return CheckCircle;
    return AlertTriangle;
  };

  const StepIcon = getStepIcon(step);

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent size="lg" open={isOpen} className="max-h-[80vh] overflow-hidden">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${variant === 'archive' ? 'bg-orange-600' : 'bg-red-600'}`}>
                <StepIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <ModalTitle className="text-xl font-semibold text-gray-900">
                  {variant === 'archive' ? 'Archive' : 'Delete'} Knowledge Entry
                </ModalTitle>
                <ModalDescription className="text-sm text-gray-600">
                  {step === 'warning' && 'This action requires confirmation'}
                  {step === 'impact' && 'Review the impact assessment'}
                  {step === 'confirmation' && 'Final confirmation required'}
                </ModalDescription>
              </div>
            </div>
            {/* Step indicator for high-impact entries */}
            {isHighImpact && (
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <div className={`w-2 h-2 rounded-full ${step === 'warning' ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <div className={`w-2 h-2 rounded-full ${step === 'impact' ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <div className={`w-2 h-2 rounded-full ${step === 'confirmation' ? 'bg-blue-600' : 'bg-gray-300'}`} />
              </div>
            )}
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody className="overflow-y-auto px-6">
          {/* Entry Preview */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">{entry.title}</h3>
                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                  <span>Category: {entry.category}</span>
                  <span>Usage: {entry.usage_count}</span>
                  <span>Success Rate: {entry.usage_count > 0 ? Math.round((entry.success_count / entry.usage_count) * 100) : 0}%</span>
                  <span>Created: {new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.tags.slice(0, 5).map(tag => (
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                    {entry.tags.length > 5 && (
                      <span className="text-xs text-gray-500">+{entry.tags.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warning Step */}
          {step === 'warning' && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">
                    {variant === 'archive' ? 'Archive Entry' : 'Permanent Deletion Warning'}
                  </h4>
                  <p className="mt-1 text-sm text-red-700">
                    {variant === 'archive'
                      ? 'This entry will be moved to the archive. It can be restored later if needed.'
                      : 'This entry will be permanently deleted and cannot be recovered. All associated data, search references, and user bookmarks will be lost.'
                    }
                  </p>
                </div>
              </div>

              {/* Related Data Loading */}
              {!relatedData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">Analyzing impact...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700">Search References</div>
                    <div className="text-2xl font-bold text-gray-900">{relatedData.searchReferences}</div>
                    <div className="text-xs text-gray-500">times found in searches</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700">User Bookmarks</div>
                    <div className="text-2xl font-bold text-gray-900">{relatedData.userBookmarks}</div>
                    <div className="text-xs text-gray-500">users have bookmarked</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700">Linked Entries</div>
                    <div className="text-2xl font-bold text-gray-900">{relatedData.linkedEntries}</div>
                    <div className="text-xs text-gray-500">entries reference this</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700">Recent Usage</div>
                    <div className="text-2xl font-bold text-gray-900">{relatedData.recentUsage}</div>
                    <div className="text-xs text-gray-500">views in last 30 days</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Impact Assessment Step */}
          {step === 'impact' && impactAssessment && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${getImpactColor(impactAssessment.level)}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Impact Assessment</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium">Risk Score:</span>
                    <span className="px-2 py-1 text-xs font-bold bg-white rounded">
                      {impactAssessment.score}/100
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="text-xs font-medium mb-2">Risk Factors:</h5>
                  <ul className="text-xs space-y-1">
                    {impactAssessment.factors.map((factor, index) => (
                      <li key={index} className="flex items-center">
                        <XCircle className="h-3 w-3 mr-2" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h5 className="text-xs font-medium mb-2">Recommendations:</h5>
                  <ul className="text-xs space-y-1">
                    {impactAssessment.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="h-3 w-3 mr-2" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Step */}
          {step === 'confirmation' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-2">Final Confirmation Required</h4>
                <p className="text-sm text-red-700 mb-3">
                  Due to the high impact of this action, please type the entry title exactly as shown below to confirm:
                </p>
                <div className="bg-white border border-red-300 rounded p-2 mb-3">
                  <code className="text-sm font-mono text-gray-900">{entry.title}</code>
                </div>
                <input
                  ref={confirmInputRef}
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="Type the entry title here..."
                  className="w-full px-3 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {confirmationInput && confirmationInput.toLowerCase() !== entry.title.toLowerCase() && (
                  <p className="mt-1 text-xs text-red-600">Title does not match. Please type it exactly as shown above.</p>
                )}
              </div>
            </div>
          )}

          {/* Additional options for delete variant */}
          {variant === 'delete' && onArchiveInstead && (step === 'warning' || step === 'impact') && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Archive className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-blue-800">Alternative: Archive Instead</h5>
                  <p className="text-sm text-blue-700 mt-1">
                    Consider archiving this entry instead of deletion. Archived entries can be restored later and won't appear in regular searches.
                  </p>
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-gray-500">
              {step === 'warning' && 'Step 1: Review impact'}
              {step === 'impact' && 'Step 2: Assess risks'}
              {step === 'confirmation' && 'Step 3: Confirm action'}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>

              {/* Archive alternative button */}
              {variant === 'delete' && onArchiveInstead && (step === 'warning' || step === 'impact') && (
                <button
                  type="button"
                  onClick={handleArchiveInstead}
                  disabled={isSubmitting || archiving}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded-md shadow-sm hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  {archiving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive Instead
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || !canProceed}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                  variant === 'archive'
                    ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {variant === 'archive' ? 'Archiving...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    {variant === 'archive' ? (
                      <Archive className="h-4 w-4 mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    {step === 'warning' && isHighImpact ? 'Continue' :
                     step === 'impact' ? 'Proceed' :
                     variant === 'archive' ? 'Archive Entry' : 'Delete Entry'}
                  </>
                )}
              </button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DeleteConfirmDialog;