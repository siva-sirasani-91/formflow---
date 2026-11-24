import { Building2 } from 'lucide-react';

export default function BusinessFilter({
  businesses = [],
  selectedBusinessId = null,
  onChange,
  error = '',
}) {
  const hasBusinesses = businesses.length > 0;
  const selectValue =
    selectedBusinessId !== null && selectedBusinessId !== undefined
      ? String(selectedBusinessId)
      : '';

  return (
    <div aria-label="Register Forms">
      <div className="ff-card p-3">
        <div className="d-flex align-items-center gap-2 mb-1">
          <Building2 size={15} className="text-primary flex-shrink-0" />
          <label
            htmlFor="business-filter-select"
            className="form-label fw-bold small mb-0 text-dark"
          >
            Saved Form
          </label>
        </div>

        <p className="text-secondary mb-2" style={{ fontSize: '0.78rem' }}>
          Choose a form to register a customer.
        </p>

        <select
          id="business-filter-select"
          className={`form-select form-select-sm ${error ? 'is-invalid' : ''}`}
          value={selectValue}
          disabled={!hasBusinesses}
          onChange={(e) => onChange(e.target.value || null)}
        >
          {!hasBusinesses ? (
            <option value="">No forms available</option>
          ) : (
            <>
              <option value="">Select a Form</option>
              {businesses.map((biz) => {
                const fieldCount = (biz.fields || []).length;
                return (
                  <option key={biz.id} value={String(biz.id)}>
                    {biz.name} ({fieldCount} {fieldCount === 1 ? 'Field' : 'Fields'})
                    {biz.archived ? ' · Archived' : ''}
                  </option>
                );
              })}
            </>
          )}
        </select>

        {error && <div className="invalid-feedback d-block">{error}</div>}
      </div>
    </div>
  );
}
