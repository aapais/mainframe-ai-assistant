# Complete Component Inventory - mainframe-ai-assistant

## Executive Summary
**Total Components Found: 221 files** (.tsx/.jsx files excluding /old directory)

This is a comprehensive inventory of ALL remaining components in `/src/renderer/components/` after the cleanup operation that moved 21 components to the `/old` folder.

## Directory Structure and File Counts

### 📊 Top-Level Directory Breakdown
```
Settings (29 files)     ████████████████████████████ 29
Search (27 files)      ███████████████████████████ 27
Tests (27 files)       ███████████████████████████ 27
UI (17 files)          █████████████████ 17
Incident (14 files)    ██████████████ 14
Common (14 files)      ██████████████ 14
Forms (9 files)        █████████ 9
KB Entry (8 files)     ████████ 8
Design System (8 files) ████████ 8
Modals (6 files)       ██████ 6
Dashboard (6 files)    ██████ 6
KBExplorer (6 files)   ██████ 6
Examples (5 files)     █████ 5
Cost (5 files)         █████ 5
Other (30 files)       ██████████████████████████████ 30
```

## 📁 Complete Directory Structure

### Root Level Components (20 files)
```
/src/renderer/components/
├── AccentureFooter.tsx (5,140 bytes)
├── AccentureLogo.tsx (4,737 bytes)
├── EnhancedKBSearchBar.tsx (26,815 bytes) ⚠️ LARGE
├── ErrorBoundary.tsx (6,447 bytes)
├── FloatingCostWidgetFixed.tsx (8,962 bytes)
├── KBDataProvider.tsx (14,498 bytes)
├── KBEntryList.tsx (18,409 bytes)
├── KBMetricsPanel.tsx (22,222 bytes)
├── KBSearchBar.tsx (25,437 bytes) ⚠️ LARGE
├── KeyboardEnabledEntryList.tsx (10,486 bytes)
├── KeyboardEnabledSearchBar.tsx (10,104 bytes)
├── KeyboardHelp.tsx (12,908 bytes)
├── LiveRegion.tsx (10,706 bytes)
├── LoadingSpinner.tsx (1,813 bytes)
├── MetricsDashboard.tsx (21,342 bytes)
├── NotificationContainer.tsx (3,413 bytes)
├── QuickActions.tsx (2,501 bytes)
├── ScreenReaderOnly.tsx (8,243 bytes)
├── SimpleAddEntryForm.tsx (13,728 bytes)
├── SimpleEntryList.tsx (11,118 bytes)
└── SimpleSearchBar.tsx (7,193 bytes)
```

### 🔧 Settings Components (29 files)
```
/settings/
├── AISettings.tsx (13,652 bytes)
├── APISettings.tsx (34,598 bytes) ⚠️ LARGE
├── AccessibilityProvider.tsx (11,267 bytes)
├── AccessibleSettingsNavigation.tsx (22,905 bytes)
├── CostManagementSettings.tsx (52,657 bytes) 🚨 VERY LARGE
├── DatabaseSettings.tsx (14,309 bytes)
├── DeveloperSettings.tsx (33,363 bytes) ⚠️ LARGE
├── EnhancedFloatingWidget.tsx (10,859 bytes)
├── FallbackModalExample.tsx (3,818 bytes)
├── FloatingWidgetSettings.tsx (10,757 bytes)
├── IntegrationsSettings.tsx (14,816 bytes)
├── LayoutSettings.tsx (26,985 bytes) ⚠️ LARGE
├── LazySettingsPanel.tsx (13,894 bytes)
├── NotificationSettings.tsx (14,381 bytes)
├── PerformanceSettings.tsx (32,558 bytes) ⚠️ LARGE
├── PreferencesSettings.tsx (20,813 bytes)
├── ProfileSettings.tsx (19,539 bytes)
├── QuickAccessWidget.tsx (17,556 bytes)
├── QuickFixExample.tsx (4,612 bytes)
├── SearchCommand.test.tsx (9,521 bytes)
├── SearchCommand.tsx (24,264 bytes)
├── SearchCommandExample.tsx (7,398 bytes)
├── SecuritySettings.tsx (34,665 bytes) ⚠️ LARGE
├── SettingsModal.tsx (25,556 bytes) ⚠️ LARGE
├── SettingsNavigation.test.tsx (10,828 bytes)
├── SettingsNavigation.tsx (28,027 bytes) ⚠️ LARGE
├── SettingsNavigationExample.tsx (7,773 bytes)
├── TestSettingsModal.tsx (14,408 bytes)
└── WidgetConfigurationSettings.tsx (21,855 bytes)
```

### 🔍 Search Components (27 files)
```
/search/
├── AISearchTab.tsx (15,217 bytes)
├── BulkOperations.tsx (19,547 bytes)
├── ContextualAddButton.tsx (14,680 bytes)
├── EnhancedSearchInterface.tsx (20,257 bytes)
├── FiltersDropdown.tsx (6,850 bytes)
├── IntelligentSearchInput.tsx (9,873 bytes)
├── LocalSearchTab.tsx (9,041 bytes)
├── OptimizedSearchResults.tsx (21,074 bytes)
├── PerformanceIndicator.tsx (16,450 bytes)
├── QueryBuilder.tsx (17,791 bytes)
├── QuickActions.tsx (10,843 bytes)
├── SearchAnalytics.tsx (26,664 bytes) ⚠️ LARGE
├── SearchAutocomplete.tsx (18,422 bytes)
├── SearchContext.tsx (1,216 bytes)
├── SearchFilters.tsx (26,144 bytes) ⚠️ LARGE
├── SearchHelpSystem.tsx (21,500 bytes)
├── SearchHistory.tsx (14,409 bytes)
├── SearchHistoryPanel.tsx (11,314 bytes)
├── SearchMetrics.tsx (12,649 bytes)
├── SearchResultCard.tsx (20,407 bytes)
├── SearchResults.optimized.tsx (27,699 bytes) ⚠️ LARGE
├── SearchResults.tsx (25,475 bytes) ⚠️ LARGE
├── SearchResultsContainer.tsx (9,194 bytes)
├── SuggestionsDropdown.tsx (6,555 bytes)
├── UnifiedSearch.tsx (15,178 bytes)
├── UnifiedSearchFixed.tsx (39,901 bytes) 🚨 VERY LARGE
└── __tests__/SearchInterface.test.tsx (15,879 bytes)
```

### 🧪 Test Components (27 files)
```
/__tests__/
├── Root Tests (13 files):
│   ├── Accessibility.test.tsx (14,001 bytes)
│   ├── AccessibilityAdvanced.test.tsx (25,092 bytes) ⚠️ LARGE
│   ├── Checkbox.test.tsx (17,018 bytes)
│   ├── EditEntryForm.test.tsx (18,678 bytes)
│   ├── ErrorHandling.test.tsx (18,791 bytes)
│   ├── FormField.test.tsx (18,417 bytes)
│   ├── FormIntegration.test.tsx (20,306 bytes)
│   ├── FormPersistence.test.tsx (17,035 bytes)
│   ├── KBEntryForm.test.tsx (18,326 bytes)
│   ├── LazyLoading.test.tsx (12,415 bytes)
│   ├── Performance.test.tsx (14,977 bytes)
│   ├── RadioButton.test.tsx (18,111 bytes)
│   ├── TextArea.test.tsx (22,087 bytes)
│   ├── VirtualScrolling.performance.test.tsx (12,043 bytes)
│   └── VisualRegression.test.tsx (20,672 bytes)
├── /accessibility/ (5 files):
│   ├── AddEntryModal.accessibility.test.tsx (33,477 bytes) 🚨 VERY LARGE
│   ├── EntryDetail.accessibility.test.tsx (24,679 bytes)
│   ├── MetricsDashboard.accessibility.test.tsx (20,221 bytes)
│   ├── ResultsList.accessibility.test.tsx (20,102 bytes)
│   └── SearchBar.accessibility.test.tsx (18,124 bytes)
├── /forms/ (2 files):
│   ├── KBEntryForm.test.tsx (18,909 bytes)
│   └── FormField.test.tsx (19,416 bytes)
├── /hooks/ (1 file):
│   └── useForm.test.tsx (18,548 bytes)
└── /interaction/ (5 files):
    ├── ComponentIntegration.interaction.test.tsx (40,294 bytes) 🚨 VERY LARGE
    ├── ErrorHandling.interaction.test.tsx (31,091 bytes) ⚠️ LARGE
    ├── KBEntryForm.interaction.test.tsx (25,692 bytes) ⚠️ LARGE
    ├── RatingSolution.interaction.test.tsx (28,457 bytes) ⚠️ LARGE
    └── SearchInterface.interaction.test.tsx (19,657 bytes)
```

### 🎨 UI Components (17 files)
```
/ui/
├── Alert.tsx (2,510 bytes)
├── Badge.tsx (5,228 bytes)
├── Button.tsx (14,737 bytes)
├── Card.tsx (16,196 bytes)
├── DataDisplay.tsx (20,194 bytes)
├── Input.tsx (13,133 bytes)
├── Label.tsx (811 bytes)
├── Layout.tsx (11,756 bytes)
├── LoadingSpinner.tsx (7,294 bytes)
├── Modal.tsx (16,922 bytes)
├── ModalFixed.tsx (11,675 bytes)
├── Navigation.tsx (21,142 bytes)
├── Separator.tsx (770 bytes)
├── SkeletonScreen.tsx (11,568 bytes)
├── Toast.tsx (6,723 bytes)
├── Typography.tsx (10,372 bytes)
└── VirtualList.tsx (12,295 bytes)
```

### 🚨 Incident Management (14 files)
```
/incident/
├── AdvancedFiltersPanel.tsx (19,673 bytes)
├── BulkUploadModal.tsx (7,795 bytes)
├── CreateIncidentModal.tsx (32,251 bytes) ⚠️ LARGE
├── EditIncidentModal.tsx (49,898 bytes) 🚨 VERY LARGE
├── EditIncidentModalExample.tsx (12,656 bytes)
├── IncidentAIPanel.tsx (19,568 bytes)
├── IncidentDetailView.tsx (44,580 bytes) 🚨 VERY LARGE
├── IncidentDetailViewExample.tsx (8,054 bytes)
├── IncidentManagementDashboard.tsx (21,029 bytes)
├── IncidentQueue.tsx (22,105 bytes)
├── PriorityBadge.tsx (942 bytes)
├── QuickActions.tsx (12,403 bytes)
├── StatusBadge.tsx (3,003 bytes)
└── StatusWorkflow.tsx (12,806 bytes)
```

### 🔗 Common Components (14 files)
```
/common/
├── AccessibleLoadingIndicator.tsx (10,348 bytes)
├── AccessibleModal.tsx (7,303 bytes)
├── Button.tsx (11,358 bytes)
├── FormField.tsx (14,059 bytes)
├── HelpDrawer.tsx (19,195 bytes)
├── LoadingIndicator.tsx (7,630 bytes)
├── NotificationSystem.tsx (12,209 bytes)
├── ScreenReaderOnly.tsx (4,107 bytes)
├── SimpleNotificationProvider.tsx (505 bytes)
├── SkeletonLoader.tsx (9,763 bytes)
├── SkipNavigation.tsx (2,859 bytes)
├── SuccessIndicator.tsx (9,499 bytes)
├── Tooltip.tsx (11,034 bytes)
└── __tests__/Button.test.tsx (16,419 bytes)
```

### 📝 Forms Components (9 files)
```
/forms/
├── EditEntryForm.tsx (9,895 bytes)
├── FloatingLabelInput.tsx (14,628 bytes)
├── IncidentForm.tsx (19,249 bytes)
├── KBEntryForm.tsx (17,034 bytes)
├── SmartDefaults.tsx (10,879 bytes)
├── __tests__/FormField.test.tsx (19,416 bytes)
├── __tests__/KBEntryForm.test.tsx (19,028 bytes)
├── /wizard/AddEntryWizardSteps.tsx (22,720 bytes)
└── /wizard/FormWizard.tsx (12,167 bytes)
```

### 📚 KB Entry Components (8 files)
```
/kb-entry/
├── KBEntryCard.tsx (9,062 bytes)
├── KBEntryDetail.tsx (22,197 bytes)
├── /actions/QuickActions.tsx (5,840 bytes)
├── /content/ProblemDisplay.tsx (5,503 bytes)
├── /content/SolutionDisplay.tsx (8,745 bytes)
├── /indicators/CategoryBadge.tsx (1,816 bytes)
├── /indicators/SuccessRateIndicator.tsx (3,923 bytes)
└── /indicators/UsageStats.tsx (5,505 bytes)
```

### 🎨 Design System (8 files)
```
/design-system/
├── EnhancedThemeSystem.tsx (19,275 bytes)
├── ThemeSystem.tsx (17,068 bytes)
├── /atoms/Icon.tsx (12,922 bytes)
├── /atoms/Input.tsx (15,547 bytes)
├── /atoms/Label.tsx (8,451 bytes)
├── /atoms/Toggle.tsx (7,194 bytes)
├── /molecules/SettingGroup.tsx (9,514 bytes)
└── /molecules/SettingRow.tsx (12,614 bytes)
```

### 🖥️ Modals (6 files)
```
/modals/
├── AddEntryModal.tsx (22,258 bytes)
├── DeleteConfirmDialog.tsx (22,017 bytes)
├── EditEntryModal.tsx (30,244 bytes) ⚠️ LARGE
├── EditKBEntryModal.tsx (21,809 bytes)
├── GeneralSettingsModal.tsx (14,828 bytes)
└── ReportIncidentModal.tsx (26,348 bytes) ⚠️ LARGE
```

### 📊 Dashboard Components (6 files)
```
/dashboard/
├── AIUsageBreakdown.tsx (17,858 bytes)
├── CostChart.tsx (12,470 bytes)
├── CostSummaryWidget.tsx (19,880 bytes)
├── DecisionHistory.tsx (23,095 bytes)
├── OperationTimeline.tsx (20,213 bytes)
└── UsageMetrics.tsx (12,303 bytes)
```

### 🔍 KBExplorer Components (6 files)
```
/KBExplorer/
├── ExportDialog.tsx (24,982 bytes)
├── FilterPanel.tsx (22,268 bytes)
├── index.tsx (26,661 bytes) ⚠️ LARGE
├── PaginationControls.tsx (17,028 bytes)
├── SavedSearchesDropdown.tsx (24,564 bytes)
└── SortableTable.tsx (20,831 bytes)
```

### 📋 Examples (5 files)
```
/examples/
├── CostSummaryWidgetExample.tsx (8,602 bytes)
├── EnhancedComponentExample.tsx (16,555 bytes)
├── IntegratedSearchCRUDExample.tsx (16,095 bytes)
├── KnowledgeBaseManagerExample.tsx (19,815 bytes)
└── SelectExample.tsx (14,837 bytes)
```

### 💰 Cost Components (5 files)
```
/cost/
├── CostAlertBanner.tsx (11,085 bytes)
├── CostDisplay.tsx (7,524 bytes)
├── CostDisplayDemo.tsx (9,411 bytes)
├── CostLimitBar.tsx (6,706 bytes)
└── DailyCostSummary.tsx (11,492 bytes)
```

### 🔧 Workflow Components (4 files)
```
/workflow/
├── OptimizedSearchResults.tsx (14,407 bytes)
├── ProgressiveFormComponent.tsx (22,825 bytes)
├── QuickActionsPanel.tsx (12,739 bytes)
└── SmartSearchInterface.tsx (16,963 bytes)
```

### ⚡ Performance Components (4 files)
```
/performance/
├── BundleAnalyzer.tsx (9,528 bytes)
├── PerformanceDashboard.tsx (19,102 bytes)
├── PerformanceMonitoring.tsx (20,172 bytes)
└── RenderingPerformanceDashboard.tsx (22,466 bytes)
```

### ♿ Accessibility Components (4 files)
```
/accessibility/
├── AccessibilityChecker.tsx (11,541 bytes)
├── AccessibilityFixSuggestions.tsx (20,151 bytes)
├── AccessibilityUtils.tsx (16,373 bytes)
└── AriaPatterns.tsx (17,199 bytes)
```

### 🤖 AI Components (3 files)
```
/ai/
├── AuthorizationDialog.tsx (14,798 bytes)
├── CostTracker.tsx (17,326 bytes)
└── OperationHistory.tsx (30,325 bytes) ⚠️ LARGE
```

### 📱 Virtualization Components (2 files)
```
/virtualization/
├── VirtualScrolling.tsx (15,406 bytes)
└── VirtualizedSettingsList.tsx (17,079 bytes)
```

### 💬 Dialog Components (2 files)
```
/dialogs/
├── AIAuthorizationDialog.tsx (29,792 bytes) ⚠️ LARGE
└── DeleteConfirmationDialog.tsx (16,109 bytes)
```

### 💰 Floating Cost Components (4 files)
```
/FloatingCostSummary/
├── FloatingCostSummary.tsx (21,902 bytes)
└── FloatingCostSummarySimple.tsx (8,873 bytes)

/FloatingCostWidget/
└── FloatingCostWidget.tsx (21,600 bytes)
```

### Single File Directories (4 files)
```
/state/StateManager.tsx (10,857 bytes)
/navigation/KBNavigation.tsx (13,970 bytes)
/layout/DashboardLayout.tsx (14,463 bytes)
/composition/CompositionPatterns.tsx (13,139 bytes)
/base/ComponentBase.tsx (8,503 bytes)
```

## 🚨 Critical Issues Identified

### 📊 Files Requiring Immediate Attention (>30KB)
1. **🚨 CostManagementSettings.tsx** - 52,657 bytes (SPLIT REQUIRED)
2. **🚨 EditIncidentModal.tsx** - 49,898 bytes (SPLIT REQUIRED)
3. **🚨 IncidentDetailView.tsx** - 44,580 bytes (SPLIT REQUIRED)
4. **🚨 ComponentIntegration.interaction.test.tsx** - 40,294 bytes (SPLIT REQUIRED)
5. **🚨 UnifiedSearchFixed.tsx** - 39,901 bytes (SPLIT REQUIRED)
6. **🚨 APISettings.tsx** - 34,598 bytes (SPLIT REQUIRED)
7. **🚨 SecuritySettings.tsx** - 34,665 bytes (SPLIT REQUIRED)
8. **🚨 AddEntryModal.accessibility.test.tsx** - 33,477 bytes (SPLIT REQUIRED)
9. **🚨 DeveloperSettings.tsx** - 33,363 bytes (SPLIT REQUIRED)
10. **🚨 CreateIncidentModal.tsx** - 32,251 bytes (SPLIT REQUIRED)
11. **🚨 PerformanceSettings.tsx** - 32,558 bytes (SPLIT REQUIRED)
12. **🚨 ErrorHandling.interaction.test.tsx** - 31,091 bytes (SPLIT REQUIRED)
13. **🚨 EditEntryModal.tsx** - 30,244 bytes (SPLIT REQUIRED)
14. **🚨 OperationHistory.tsx** - 30,325 bytes (SPLIT REQUIRED)

### ⚠️ Files Needing Optimization (20-30KB)
- SearchAnalytics.tsx (26,664 bytes)
- SearchFilters.tsx (26,144 bytes)
- EnhancedKBSearchBar.tsx (26,815 bytes)
- KBExplorer/index.tsx (26,661 bytes)
- ReportIncidentModal.tsx (26,348 bytes)
- SearchResults.optimized.tsx (27,699 bytes)
- SearchResults.tsx (25,475 bytes)
- SettingsNavigation.tsx (28,027 bytes)
- LayoutSettings.tsx (26,985 bytes)
- SettingsModal.tsx (25,556 bytes)
- KBSearchBar.tsx (25,437 bytes)
- AccessibilityAdvanced.test.tsx (25,092 bytes)

## 📈 Statistics Summary

### Size Distribution
- **🚨 Critical (>30KB)**: 14 files (6.3%)
- **⚠️ Large (20-30KB)**: 32 files (14.5%)
- **📄 Medium (10-20KB)**: 87 files (39.4%)
- **📄 Small (<10KB)**: 88 files (39.8%)

### Category Distribution
- **Settings**: 29 files (13.1%) - Largest category
- **Search**: 27 files (12.2%) - Core functionality
- **Tests**: 27 files (12.2%) - Quality assurance
- **UI Components**: 17 files (7.7%) - Base UI elements
- **Incident Management**: 14 files (6.3%) - Business logic
- **Common Components**: 14 files (6.3%) - Shared utilities
- **Other Categories**: 93 files (42.1%) - Specialized functionality

## 🎯 Recommendations

### Immediate Actions Required
1. **Split large files (>30KB)** into smaller, focused components
2. **Refactor monolithic settings** into specialized sub-components
3. **Break down test files** into focused test suites
4. **Extract common functionality** from large search components
5. **Implement lazy loading** for heavy dashboard components

### Component Architecture Improvements
1. **Create design system hierarchy** for better organization
2. **Implement compound component patterns** for complex UI elements
3. **Extract business logic** from presentation components
4. **Standardize component interfaces** across similar functionality
5. **Implement proper error boundaries** for each major feature area

### Code Quality Priorities
1. **Accessibility compliance** - Many components need ARIA improvements
2. **Performance optimization** - Several components have rendering bottlenecks
3. **Type safety** - Strengthen TypeScript usage across components
4. **Testing coverage** - Expand unit and integration test coverage
5. **Documentation** - Add JSDoc comments for all public APIs

---

**Generated**: 2025-09-19T18:03:30Z
**Total Components Analyzed**: 221 files
**Total Directories**: 41
**Exclusions**: /old directory (21 previously moved components)