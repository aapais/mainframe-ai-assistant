import React, { useState } from 'react';
import { Select, SelectOption, SelectOptionGroup } from '../Select';

// Example data
const basicOptions: SelectOption[] = [
  { label: 'React', value: 'react' },
  { label: 'Vue.js', value: 'vue' },
  { label: 'Angular', value: 'angular' },
  { label: 'Svelte', value: 'svelte', disabled: true },
  { label: 'Next.js', value: 'nextjs' },
];

const optionsWithDescriptions: SelectOption[] = [
  {
    label: 'VSAM Status 35',
    value: 'vsam35',
    description: 'File not found error - check dataset catalog'
  },
  {
    label: 'S0C7 Abend',
    value: 's0c7',
    description: 'Data exception - verify numeric field contents'
  },
  {
    label: 'JCL Error IEF212I',
    value: 'ief212i',
    description: 'Dataset not found - verify dataset name and allocation'
  },
  {
    label: 'DB2 SQLCODE -904',
    value: 'sql904',
    description: 'Resource unavailable - check tablespace status'
  },
];

const frameworkGroups: SelectOptionGroup[] = [
  {
    label: 'Frontend Frameworks',
    options: [
      { label: 'React', value: 'react' },
      { label: 'Vue.js', value: 'vue' },
      { label: 'Angular', value: 'angular' },
      { label: 'Svelte', value: 'svelte' },
    ]
  },
  {
    label: 'Backend Frameworks',
    options: [
      { label: 'Node.js', value: 'nodejs' },
      { label: 'Django', value: 'django' },
      { label: 'Ruby on Rails', value: 'rails' },
      { label: 'Express.js', value: 'express' },
    ]
  },
  {
    label: 'Full-Stack Solutions',
    options: [
      { label: 'Next.js', value: 'nextjs' },
      { label: 'Nuxt.js', value: 'nuxtjs' },
      { label: 'SvelteKit', value: 'sveltekit' },
    ]
  }
];

export function SelectExample() {
  const [basicValue, setBasicValue] = useState<string | undefined>();
  const [multiValue, setMultiValue] = useState<string[]>(['react']);
  const [searchableValue, setSearchableValue] = useState<string | undefined>();
  const [groupValue, setGroupValue] = useState<string | undefined>();
  const [customValue, setCustomValue] = useState<string | undefined>();

  // Custom filter function for mainframe errors
  const customFilter = (option: SelectOption, searchTerm: string) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      option.label.toLowerCase().includes(searchLower) ||
      (option.description && option.description.toLowerCase().includes(searchLower)) ||
      option.value.toString().toLowerCase().includes(searchLower)
    );
  };

  // Custom option renderer
  const customOptionRenderer = (
    option: SelectOption,
    state: { selected: boolean; highlighted: boolean }
  ) => {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              option.value === 'react' ? 'bg-blue-500' :
              option.value === 'vue' ? 'bg-green-500' :
              option.value === 'angular' ? 'bg-red-500' :
              'bg-gray-400'
            }`}
          />
          <div>
            <div className="font-medium">{option.label}</div>
            {option.description && (
              <div className="text-xs text-muted-foreground mt-1">
                {option.description}
              </div>
            )}
          </div>
        </div>
        {state.selected && (
          <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    );
  };

  // Custom value renderer for multi-select
  const customValueRenderer = (value: string | string[], options: SelectOption[]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">Select frameworks...</span>;
      }
      if (value.length === 1) {
        const option = options.find(opt => opt.value === value[0]);
        return option?.label || value[0];
      }
      return (
        <div className="flex items-center gap-2">
          <span>{value.length} frameworks selected</span>
          <div className="flex gap-1">
            {value.slice(0, 3).map((val, index) => {
              const option = options.find(opt => opt.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs"
                >
                  {option?.label || val}
                </span>
              );
            })}
            {value.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{value.length - 3} more
              </span>
            )}
          </div>
        </div>
      );
    }
    return value;
  };

  return (
    <div className="space-y-8 p-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Select Component Examples</h1>

      {/* Basic Select */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Basic Select</h2>
        <div className="space-y-2">
          <label htmlFor="basic-select" className="text-sm font-medium">
            Choose a framework:
          </label>
          <Select
            id="basic-select"
            options={basicOptions}
            value={basicValue}
            onChange={setBasicValue}
            placeholder="Select a framework..."
            aria-label="Basic framework selector"
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Selected: {basicValue || 'None'}
          </p>
        </div>
      </section>

      {/* Multi-Select */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Multi-Select</h2>
        <div className="space-y-2">
          <label htmlFor="multi-select" className="text-sm font-medium">
            Choose multiple frameworks:
          </label>
          <Select
            id="multi-select"
            options={basicOptions}
            value={multiValue}
            onChange={setMultiValue}
            multiple
            maxSelections={3}
            placeholder="Select frameworks..."
            aria-label="Multi-select framework selector"
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Selected: {multiValue.join(', ') || 'None'}
          </p>
        </div>
      </section>

      {/* Searchable Select */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Searchable Select</h2>
        <div className="space-y-2">
          <label htmlFor="searchable-select" className="text-sm font-medium">
            Search for mainframe errors:
          </label>
          <Select
            id="searchable-select"
            options={optionsWithDescriptions}
            value={searchableValue}
            onChange={setSearchableValue}
            searchable
            filterFunction={customFilter}
            placeholder="Search errors..."
            searchPlaceholder="Type to search errors..."
            aria-label="Searchable error selector"
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Selected: {searchableValue || 'None'}
          </p>
        </div>
      </section>

      {/* Grouped Options */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Grouped Options</h2>
        <div className="space-y-2">
          <label htmlFor="grouped-select" className="text-sm font-medium">
            Choose from grouped options:
          </label>
          <Select
            id="grouped-select"
            optionGroups={frameworkGroups}
            value={groupValue}
            onChange={setGroupValue}
            searchable
            placeholder="Select from groups..."
            aria-label="Grouped options selector"
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Selected: {groupValue || 'None'}
          </p>
        </div>
      </section>

      {/* Custom Rendering */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Custom Rendering</h2>
        <div className="space-y-2">
          <label htmlFor="custom-select" className="text-sm font-medium">
            Framework with custom rendering:
          </label>
          <Select
            id="custom-select"
            options={optionsWithDescriptions}
            value={customValue}
            onChange={setCustomValue}
            renderOption={customOptionRenderer}
            renderValue={customValueRenderer}
            placeholder="Choose with style..."
            aria-label="Custom rendering selector"
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            Selected: {customValue || 'None'}
          </p>
        </div>
      </section>

      {/* Different States */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Different States</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Loading State:</label>
            <Select
              options={basicOptions}
              loading
              loadingMessage="Loading frameworks..."
              placeholder="Loading..."
              aria-label="Loading state example"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Disabled State:</label>
            <Select
              options={basicOptions}
              disabled
              value="react"
              placeholder="Disabled..."
              aria-label="Disabled state example"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Error State:</label>
            <Select
              options={basicOptions}
              state="error"
              placeholder="Error state..."
              aria-label="Error state example"
              aria-invalid
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Success State:</label>
            <Select
              options={basicOptions}
              state="success"
              value="react"
              placeholder="Success state..."
              aria-label="Success state example"
            />
          </div>
        </div>
      </section>

      {/* Size Variations */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Size Variations</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Small Size:</label>
            <Select
              options={basicOptions}
              size="sm"
              placeholder="Small select..."
              aria-label="Small size example"
              className="w-64"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Default Size:</label>
            <Select
              options={basicOptions}
              placeholder="Default select..."
              aria-label="Default size example"
              className="w-64"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Large Size:</label>
            <Select
              options={basicOptions}
              size="lg"
              placeholder="Large select..."
              aria-label="Large size example"
              className="w-64"
            />
          </div>
        </div>
      </section>

      {/* Accessibility Features */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Accessibility Features</h2>
        <div className="bg-muted p-4 rounded-md">
          <h3 className="font-medium mb-2">Keyboard Navigation:</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li><kbd className="px-1 py-0.5 bg-background rounded">Space</kbd> or <kbd className="px-1 py-0.5 bg-background rounded">Enter</kbd> - Open dropdown</li>
            <li><kbd className="px-1 py-0.5 bg-background rounded">↑</kbd><kbd className="px-1 py-0.5 bg-background rounded">↓</kbd> - Navigate options</li>
            <li><kbd className="px-1 py-0.5 bg-background rounded">Home</kbd><kbd className="px-1 py-0.5 bg-background rounded">End</kbd> - First/Last option</li>
            <li><kbd className="px-1 py-0.5 bg-background rounded">Esc</kbd> - Close dropdown</li>
            <li><kbd className="px-1 py-0.5 bg-background rounded">Alt</kbd>+<kbd className="px-1 py-0.5 bg-background rounded">↑</kbd> - Close dropdown</li>
            <li>Type letters - Type-ahead search</li>
          </ul>
        </div>
      </section>

      {/* Form Integration Example */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Form Integration</h2>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Form submitted!'); }}>
          <div className="space-y-2">
            <label htmlFor="form-select" className="text-sm font-medium">
              Required framework selection:
            </label>
            <Select
              id="form-select"
              name="framework"
              options={basicOptions}
              required
              placeholder="Select a framework..."
              aria-label="Required framework selector"
              aria-describedby="framework-help"
              className="w-full"
            />
            <p id="framework-help" className="text-xs text-muted-foreground">
              Please select at least one framework for your project.
            </p>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Submit Form
          </button>
        </form>
      </section>
    </div>
  );
}