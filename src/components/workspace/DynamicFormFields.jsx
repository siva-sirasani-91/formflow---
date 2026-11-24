import { Plus, Trash2 } from 'lucide-react';

export default function DynamicFormFields({
  fields = [],
  answers = {},
  repeatingTables = {},
  errors = {},
  onAnswerChange,
  onTableChange,
}) {
  if (!fields.length) {
    return (
      <div className="p-3 rounded-3 border bg-light bg-opacity-50 small text-secondary">
        No form fields have been added to this business yet. Add fields in Create Forms or enter payment details below.
      </div>
    );
  }

  function handleAddRow(field) {
    const existing = Array.isArray(repeatingTables[field.fieldName])
      ? repeatingTables[field.fieldName]
      : [];
    const emptyRow = {};
    (field.columns || []).forEach((col) => {
      emptyRow[col.name] = col.type === 'number' ? '' : '';
    });
    onTableChange(field.fieldName, [...existing, emptyRow]);
  }

  function handleRemoveRow(field, rowIdx) {
    const existing = Array.isArray(repeatingTables[field.fieldName])
      ? repeatingTables[field.fieldName]
      : [];
    onTableChange(
      field.fieldName,
      existing.filter((_, idx) => idx !== rowIdx)
    );
  }

  function handleCellChange(field, rowIdx, colName, value) {
    const existing = Array.isArray(repeatingTables[field.fieldName])
      ? repeatingTables[field.fieldName]
      : [];
    const nextRows = existing.map((row, idx) =>
      idx === rowIdx
        ? {
            ...row,
            [colName]: value,
          }
        : row
    );
    onTableChange(field.fieldName, nextRows);
  }

  return (
    <div className="row g-3">
      {fields.map((field) => {
        const err = errors[field.fieldName];
        const value = answers[field.fieldName];

        if (field.type === 'table') {
          const rows = Array.isArray(repeatingTables[field.fieldName])
            ? repeatingTables[field.fieldName]
            : [];
          const cols = field.columns || [];

          return (
            <div key={field.id || field.fieldName} className="col-12">
              <div className="p-3 rounded-3 border bg-light bg-opacity-25">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <label className="form-label fw-semibold small mb-0">
                    {field.label}
                    {field.required && <span className="text-danger ms-1">*</span>}
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-ff-outline py-1 px-2 d-inline-flex align-items-center gap-1"
                    onClick={() => handleAddRow(field)}
                  >
                    <Plus size={14} />
                    <span>Add Row</span>
                  </button>
                </div>

                {rows.length === 0 ? (
                  <div className="small text-secondary py-2">
                    No rows added yet. Click &ldquo;Add Row&rdquo; to enter items.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered bg-white align-middle mb-0">
                      <thead>
                        <tr className="small text-secondary">
                          {cols.map((col) => (
                            <th key={col.id || col.name} className="fw-semibold">
                              {col.label}
                              {col.required && <span className="text-danger ms-1">*</span>}{' '}
                              ({col.type === 'number' ? 'Number' : col.type === 'date' ? 'Date' : 'Text'})
                            </th>
                          ))}
                          <th style={{ width: '64px' }} className="text-center">
                            Remove
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {cols.map((col) => (
                              <td key={col.id || col.name}>
                                <input
                                  type={
                                    col.type === 'number'
                                      ? 'number'
                                      : col.type === 'date'
                                        ? 'date'
                                        : 'text'
                                  }
                                  required={Boolean(col.required)}
                                  className="form-control form-control-sm"
                                  style={{ minWidth: '120px' }}
                                  value={row[col.name] ?? ''}
                                  onChange={(e) =>
                                    handleCellChange(
                                      field,
                                      rIdx,
                                      col.name,
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                            ))}
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm btn-light border text-danger p-1"
                                aria-label="Remove row"
                                onClick={() => handleRemoveRow(field, rIdx)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {err && <div className="invalid-feedback d-block mt-1">{err}</div>}
              </div>
            </div>
          );
        }

        return (
          <div key={field.id || field.fieldName} className="col-md-6">
            <label
              htmlFor={`dyn-${field.fieldName}`}
              className="form-label fw-semibold small"
            >
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
            </label>

            {field.type === 'select' ? (
              <select
                id={`dyn-${field.fieldName}`}
                className={`form-select ${err ? 'is-invalid' : ''}`}
                value={value ?? ''}
                onChange={(e) => onAnswerChange(field.fieldName, e.target.value)}
              >
                <option value="">Select {field.label}...</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === 'boolean' ? (
              <div className="d-flex gap-3 pt-1">
                <div className="form-check">
                  <input
                    id={`dyn-${field.fieldName}-yes`}
                    type="radio"
                    name={`dyn-${field.fieldName}`}
                    className="form-check-input"
                    checked={value === true}
                    onChange={() => onAnswerChange(field.fieldName, true)}
                  />
                  <label htmlFor={`dyn-${field.fieldName}-yes`} className="form-check-label small">
                    Yes
                  </label>
                </div>
                <div className="form-check">
                  <input
                    id={`dyn-${field.fieldName}-no`}
                    type="radio"
                    name={`dyn-${field.fieldName}`}
                    className="form-check-input"
                    checked={value === false}
                    onChange={() => onAnswerChange(field.fieldName, false)}
                  />
                  <label htmlFor={`dyn-${field.fieldName}-no`} className="form-check-label small">
                    No
                  </label>
                </div>
              </div>
            ) : (
              <input
                id={`dyn-${field.fieldName}`}
                type={
                  field.type === 'number'
                    ? 'number'
                    : field.type === 'date'
                      ? 'date'
                      : 'text'
                }
                className={`form-control ${err ? 'is-invalid' : ''}`}
                value={value ?? ''}
                onChange={(e) => onAnswerChange(field.fieldName, e.target.value)}
              />
            )}

            {err && <div className="invalid-feedback d-block">{err}</div>}
          </div>
        );
      })}
    </div>
  );
}
