/**
 * AI Authorization Dialog - UC001 Implementation
 * 
 * Modal dialog for AI search authorization with:
 * 1. Cost estimation display
 * 2. Data sensitivity warnings
 * 3. User choice persistence options
 * 4. Clear approve/deny actions
 * 5. Performance impact information
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import {
  Brain,
  DollarSign,
  Clock,
  Shield,
  AlertTriangle,
  Info,
  Zap,
  CheckCircle
} from 'lucide-react';
import { useAuthorizationDialog } from '../../renderer/contexts/SearchContext';

interface AIAuthorizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  estimatedCost?: number;
  onApprove: () => void;
  onDeny: () => void;
  dataContext?: {
    containsPII: boolean;
    isConfidential: boolean;
    dataTypes: string[];
  };
}

export function AIAuthorizationDialog({
  isOpen,
  onClose,
  query,
  estimatedCost = 0.005,
  onApprove,
  onDeny,
  dataContext
}: AIAuthorizationDialogProps) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [selectedScope, setSelectedScope] = useState<'session' | 'category' | 'always'>('session');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-focus handling
  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setRememberChoice(false);
      setSelectedScope('session');
      setShowAdvanced(false);
    }
  }, [isOpen]);

  const handleApprove = useCallback(() => {
    onApprove();
    onClose();
  }, [onApprove, onClose]);

  const handleDeny = useCallback(() => {
    onDeny();
    onClose();
  }, [onDeny, onClose]);

  const handleApproveAlways = useCallback(() => {
    // Handle "approve always" logic here
    onApprove();
    onClose();
  }, [onApprove, onClose]);

  const getSeverityLevel = (): 'low' | 'medium' | 'high' => {
    if (dataContext?.containsPII || dataContext?.isConfidential) return 'high';
    if (estimatedCost > 0.01) return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
    }
  };

  const severity = getSeverityLevel();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            AI Search Authorization Required
          </DialogTitle>
          <DialogDescription>
            This search query will use AI to enhance results. Please review the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Query Display */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-1">Search Query</div>
            <div className="font-mono text-sm bg-white p-2 rounded border">
              {query}
            </div>
          </div>

          {/* Cost and Performance Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                <DollarSign className="h-4 w-4" />
                Estimated Cost
              </div>
              <div className="text-2xl font-bold text-green-800">
                ${estimatedCost.toFixed(4)}
              </div>
              <div className="text-xs text-green-600">Per search</div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                <Clock className="h-4 w-4" />
                Processing Time
              </div>
              <div className="text-2xl font-bold text-blue-800">
                2-5s
              </div>
              <div className="text-xs text-blue-600">Additional delay</div>
            </div>
          </div>

          {/* Data Sensitivity Warnings */}
          {(dataContext?.containsPII || dataContext?.isConfidential) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Data Sensitivity Warning</div>
                {dataContext.containsPII && (
                  <div className="text-sm">• Query may contain personally identifiable information</div>
                )}
                {dataContext.isConfidential && (
                  <div className="text-sm">• Query contains confidential information</div>
                )}
                <div className="text-sm mt-1 text-yellow-800">
                  Your data will be processed securely but consider if AI enhancement is necessary.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Severity Badge */}
          <div className="flex items-center gap-2">
            <Badge variant={getSeverityColor(severity)} className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {severity.toUpperCase()} SENSITIVITY
            </Badge>
            {dataContext?.dataTypes && (
              <div className="flex gap-1">
                {dataContext.dataTypes.map((type) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Benefits of AI Search */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
              <Zap className="h-4 w-4" />
              AI Enhancement Benefits
            </div>
            <ul className="text-sm text-blue-700 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Semantic understanding of mainframe error codes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Context-aware solution recommendations
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Related problem identification
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Improved result relevance scoring
              </li>
            </ul>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="border-t pt-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-choice"
                    checked={rememberChoice}
                    onCheckedChange={setRememberChoice}
                  />
                  <label
                    htmlFor="remember-choice"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember my choice for similar queries
                  </label>
                </div>

                {rememberChoice && (
                  <div className="ml-6 space-y-2">
                    <div className="text-sm text-gray-600">Apply this choice to:</div>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="scope"
                          value="session"
                          checked={selectedScope === 'session'}
                          onChange={(e) => setSelectedScope(e.target.value as any)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">This session only</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="scope"
                          value="category"
                          checked={selectedScope === 'category'}
                          onChange={(e) => setSelectedScope(e.target.value as any)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Similar queries (same category)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="scope"
                          value="always"
                          checked={selectedScope === 'always'}
                          onChange={(e) => setSelectedScope(e.target.value as any)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">All future searches</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Information Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Local search results are already available. AI enhancement will provide additional
              context and improved relevance but is not required for basic functionality.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDeny}>
              Use Local Only
            </Button>
            <Button onClick={handleApprove} className="bg-blue-600 hover:bg-blue-700">
              Approve AI Search
            </Button>
            {rememberChoice && (
              <Button
                onClick={handleApproveAlways}
                className="bg-green-600 hover:bg-green-700"
              >
                Approve & Remember
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook-based wrapper for the authorization dialog
 */
export function useAIAuthorizationDialog() {
  const { authDialog, showAuthDialog, hideAuthDialog } = useAuthorizationDialog();
  
  return {
    isOpen: authDialog.isOpen,
    query: authDialog.query,
    estimatedCost: authDialog.estimatedCost,
    showDialog: showAuthDialog,
    hideDialog: hideAuthDialog,
    onApprove: authDialog.onApprove,
    onDeny: authDialog.onDeny,
    onCancel: authDialog.onCancel
  };
}

/**
 * Simplified authorization dialog for quick decisions
 */
export function QuickAuthorizationDialog({
  isOpen,
  onClose,
  query,
  onApprove,
  onDeny
}: {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Enable AI Search?
          </DialogTitle>
          <DialogDescription>
            Enhance your search with AI for better results and context.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="font-mono text-sm">{query}</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDeny}>
            Local Only
          </Button>
          <Button onClick={onApprove} className="bg-blue-600 hover:bg-blue-700">
            Use AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}