import fs from 'node:fs';
import path from 'node:path';
import {
  getAuthenticatedUser,
  hashPassword,
  readAuthStore,
  sanitizeUser,
  verifyPassword,
  writeAuthStore,
} from './authStore.js';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const WORKSPACE_PATH = path.join(DATA_DIR, 'workspace-store.json');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DUPLICATE_SUBMISSION_WINDOW_MS = 60 * 1000;

function isStrongPassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

function getLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function createInitialSeed() {
  const today = getLocalDateStr();
  const yesterday = getLocalDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const threeDaysAgo = getLocalDateStr(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
  const tenDaysAgo = getLocalDateStr(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000));

  return {
    businesses: [
      {
        id: 101,
        userId: 1,
        name: 'Apex Dental Studio',
        category: 'Healthcare & Clinics',
        phone: '+91 98490 22110',
        email: 'care@apexdental.in',
        address: '42 Jubilee Hills Road, Hyderabad',
        description: 'Patient intake, dental procedure billing, and treatment consent records.',
        archived: false,
        createdAt: daysAgoIso(45),
        updatedAt: daysAgoIso(2),
        fields: [
          {
            id: 'f_patient_age',
            fieldName: 'patient_age',
            label: 'Patient Age',
            type: 'number',
            required: true,
            options: [],
            columns: [],
          },
          {
            id: 'f_visit_type',
            fieldName: 'visit_type',
            label: 'Visit Category',
            type: 'select',
            required: true,
            options: ['Routine Checkup', 'Root Canal', 'Orthodontics', 'Emergency Care'],
            columns: [],
          },
          {
            id: 'f_visit_date',
            fieldName: 'appointment_date',
            label: 'Appointment Date',
            type: 'date',
            required: true,
            options: [],
            columns: [],
          },
          {
            id: 'f_insurance',
            fieldName: 'has_insurance',
            label: 'Covered by Health Insurance',
            type: 'boolean',
            required: false,
            options: [],
            columns: [],
          },
          {
            id: 'f_notes',
            fieldName: 'clinical_notes',
            label: 'Chief Complaint / Notes',
            type: 'text',
            required: false,
            options: [],
            columns: [],
          },
          {
            id: 'f_treatments',
            fieldName: 'procedures_table',
            label: 'Procedures & Materials Used',
            type: 'table',
            required: true,
            options: [],
            columns: [
              { id: 'col_proc', name: 'procedure', label: 'Procedure Name', type: 'text' },
              { id: 'col_qty', name: 'sessions', label: 'Sessions', type: 'number' },
              { id: 'col_fee', name: 'unit_fee', label: 'Unit Fee', type: 'number' },
            ],
          },
        ],
      },
      {
        id: 102,
        userId: 1,
        name: 'Vanguard Logistics Hub',
        category: 'Logistics & Supply Chain',
        phone: '+91 91210 77880',
        email: 'dispatch@vanguardhub.com',
        address: 'Plot 18, IDA Nacharam, Hyderabad',
        description: 'Freight booking intake, consignment manifests, and carrier settlement logs.',
        archived: false,
        createdAt: daysAgoIso(30),
        updatedAt: daysAgoIso(1),
        fields: [
          {
            id: 'f_route',
            fieldName: 'route_corridor',
            label: 'Shipping Corridor',
            type: 'select',
            required: true,
            options: ['Hyderabad - Bengaluru', 'Hyderabad - Chennai', 'Hyderabad - Mumbai', 'Pan-India Express'],
            columns: [],
          },
          {
            id: 'f_weight',
            fieldName: 'total_weight_kg',
            label: 'Total Weight (kg)',
            type: 'number',
            required: true,
            options: [],
            columns: [],
          },
          {
            id: 'f_dispatch_date',
            fieldName: 'dispatch_date',
            label: 'Scheduled Dispatch Date',
            type: 'date',
            required: true,
            options: [],
            columns: [],
          },
          {
            id: 'f_fragile',
            fieldName: 'fragile_handling',
            label: 'Requires Fragile Handling',
            type: 'boolean',
            required: false,
            options: [],
            columns: [],
          },
          {
            id: 'f_manifest',
            fieldName: 'cargo_items',
            label: 'Cargo Manifest Items',
            type: 'table',
            required: true,
            options: [],
            columns: [
              { id: 'col_sku', name: 'item_desc', label: 'Package Description', type: 'text' },
              { id: 'col_boxes', name: 'boxes', label: 'Box Count', type: 'number' },
              { id: 'col_wt', name: 'weight_kg', label: 'Weight (kg)', type: 'number' },
            ],
          },
        ],
      },
      {
        id: 103,
        userId: 1,
        name: 'Horizon Co-Working Space',
        category: 'Real Estate & Operations',
        phone: '+91 90001 55443',
        email: 'desk@horizonspaces.co',
        address: 'Madhapur HITEC City, Hyderabad',
        description: 'Legacy seasonal desk pass registrations.',
        archived: true,
        createdAt: daysAgoIso(90),
        updatedAt: daysAgoIso(20),
        fields: [
          {
            id: 'f_desk_type',
            fieldName: 'desk_tier',
            label: 'Workspace Tier',
            type: 'select',
            required: true,
            options: ['Hot Desk', 'Dedicated Desk', 'Private Cabin'],
            columns: [],
          },
        ],
      },
    ],
    records: [
      {
        id: 1001,
        userId: 1,
        businessId: 101,
        customerName: 'Ananya Reddy',
        customerPhone: '+91 98480 11223',
        customerEmail: 'ananya.reddy@example.com',
        answers: {
          patient_age: 34,
          visit_type: 'Root Canal',
          appointment_date: today,
          has_insurance: true,
          clinical_notes: 'Lower molar sensitivity; prescribed digital X-ray.',
        },
        repeatingTables: {
          procedures_table: [
            { procedure: 'Digital Radiograph', sessions: 1, unit_fee: 800 },
            { procedure: 'Root Canal Therapy', sessions: 2, unit_fee: 2400 },
          ],
        },
        payment: {
          amount: 5600,
          method: 'Online',
          transactionId: 'UPI-9482710482',
          paidAt: today,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
      {
        id: 1002,
        userId: 1,
        businessId: 101,
        customerName: 'Vikram Sharma',
        customerPhone: '+91 99123 44556',
        customerEmail: 'vikram.s@example.com',
        answers: {
          patient_age: 29,
          visit_type: 'Routine Checkup',
          appointment_date: yesterday,
          has_insurance: false,
          clinical_notes: 'Annual scaling and polishing completed.',
        },
        repeatingTables: {
          procedures_table: [
            { procedure: 'Consultation & Oral Exam', sessions: 1, unit_fee: 500 },
            { procedure: 'Ultrasonic Scaling', sessions: 1, unit_fee: 1200 },
          ],
        },
        payment: {
          amount: 1700,
          method: 'Cash',
          transactionId: '',
          paidAt: yesterday,
        },
        createdAt: daysAgoIso(1),
        updatedAt: daysAgoIso(1),
        deletedAt: null,
      },
      {
        id: 1003,
        userId: 1,
        businessId: 102,
        customerName: 'Srinivas Rao',
        customerPhone: '+91 97012 88990',
        customerEmail: 'srinivas@deccanimports.in',
        answers: {
          route_corridor: 'Hyderabad - Bengaluru',
          total_weight_kg: 420,
          dispatch_date: today,
          fragile_handling: true,
        },
        repeatingTables: {
          cargo_items: [
            { item_desc: 'Medical Lab Glassware', boxes: 12, weight_kg: 180 },
            { item_desc: 'Precision Calibration Units', boxes: 6, weight_kg: 240 },
          ],
        },
        payment: {
          amount: 14500,
          method: 'Online',
          transactionId: 'NEFT-883719204',
          paidAt: today,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
      {
        id: 1004,
        userId: 1,
        businessId: 102,
        customerName: 'Meera Krishnan',
        customerPhone: '+91 94401 33221',
        customerEmail: 'meera@krishnantextiles.com',
        answers: {
          route_corridor: 'Hyderabad - Chennai',
          total_weight_kg: 260,
          dispatch_date: threeDaysAgo,
          fragile_handling: false,
        },
        repeatingTables: {
          cargo_items: [
            { item_desc: 'Woven Fabric Bales', boxes: 10, weight_kg: 260 },
          ],
        },
        payment: {
          amount: 8200,
          method: 'Cash',
          transactionId: '',
          paidAt: threeDaysAgo,
        },
        createdAt: daysAgoIso(3),
        updatedAt: daysAgoIso(3),
        deletedAt: null,
      },
      {
        id: 1005,
        userId: 1,
        businessId: 101,
        customerName: 'Karthik Varma',
        customerPhone: '+91 98660 77441',
        customerEmail: 'karthik.varma@example.com',
        answers: {
          patient_age: 41,
          visit_type: 'Orthodontics',
          appointment_date: tenDaysAgo,
          has_insurance: true,
          clinical_notes: 'Clear aligner scan and upper arch fitting.',
        },
        repeatingTables: {
          procedures_table: [
            { procedure: '3D Intraoral Scan', sessions: 1, unit_fee: 2500 },
            { procedure: 'Aligner Tray Set', sessions: 1, unit_fee: 9500 },
          ],
        },
        payment: {
          amount: 12000,
          method: 'Online',
          transactionId: 'CARD-550192837',
          paidAt: tenDaysAgo,
        },
        createdAt: daysAgoIso(10),
        updatedAt: daysAgoIso(10),
        deletedAt: null,
      },
      {
        id: 1006,
        userId: 1,
        businessId: 101,
        customerName: 'Rohan Deshmukh',
        customerPhone: '+91 93900 12004',
        customerEmail: 'rohan.d@example.com',
        answers: {
          patient_age: 26,
          visit_type: 'Emergency Care',
          appointment_date: threeDaysAgo,
          has_insurance: false,
          clinical_notes: 'Duplicate entry removed by front desk.',
        },
        repeatingTables: {
          procedures_table: [
            { procedure: 'Emergency Consultation', sessions: 1, unit_fee: 750 },
          ],
        },
        payment: {
          amount: 750,
          method: 'Cash',
          transactionId: '',
          paidAt: threeDaysAgo,
        },
        createdAt: daysAgoIso(5),
        updatedAt: daysAgoIso(3),
        deletedAt: daysAgoIso(3),
      },
    ],
    settings: [
      {
        userId: 1,
        language: 'en',
        phoneAlerts: true,
        emailReceipts: true,
        twoFactorOtp: false,
        dailyBackup: true,
        lastBackupAt: daysAgoIso(1),
      },
    ],
    tickets: [
      {
        id: 501,
        userId: 1,
        subject: 'Custom invoice header logo sizing',
        category: 'Billing & PDFs',
        description: 'Would like guidance on recommended dimensions for clinic letterhead on customer PDFs.',
        status: 'In Progress',
        createdAt: daysAgoIso(4),
        updatedAt: daysAgoIso(2),
      },
      {
        id: 502,
        userId: 1,
        subject: 'Enable Telugu labels for front-desk staff',
        category: 'General Settings',
        description: 'Confirmed language selector in Settings switches sidebar and core headings smoothly.',
        status: 'Resolved',
        createdAt: daysAgoIso(12),
        updatedAt: daysAgoIso(9),
      },
    ],
  };
}

function ensureWorkspaceStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(WORKSPACE_PATH)) {
    fs.writeFileSync(WORKSPACE_PATH, JSON.stringify(createInitialSeed(), null, 2));
  }
}

function readWorkspace() {
  ensureWorkspaceStore();
  return JSON.parse(fs.readFileSync(WORKSPACE_PATH, 'utf8'));
}

function writeWorkspace(store) {
  ensureWorkspaceStore();
  fs.writeFileSync(WORKSPACE_PATH, JSON.stringify(store, null, 2));
}

function pruneExpiredRecycleBin(store) {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const beforeRecs = store.records.length;
  const beforeBiz = store.businesses.length;
  const expiredBizIds = new Set(
    store.businesses
      .filter((b) => b.deletedAt && new Date(b.deletedAt).getTime() < cutoff)
      .map((b) => b.id)
  );
  if (expiredBizIds.size > 0) {
    store.businesses = store.businesses.filter((b) => !expiredBizIds.has(b.id));
    store.records = store.records.filter((r) => !expiredBizIds.has(r.businessId));
  }
  store.records = store.records.filter(
    (r) => !r.deletedAt || new Date(r.deletedAt).getTime() >= cutoff
  );
  if (store.records.length !== beforeRecs || store.businesses.length !== beforeBiz) {
    writeWorkspace(store);
  }
}

function getOrCreateUserSettings(store, userId) {
  let settings = store.settings.find((s) => s.userId === userId);
  if (!settings) {
    settings = {
      userId,
      language: 'en',
      phoneAlerts: true,
      emailReceipts: true,
      twoFactorOtp: false,
      dailyBackup: false,
      lastBackupAt: null,
    };
    store.settings.push(settings);
    writeWorkspace(store);
  }
  return settings;
}

function nextId(items, start = 1) {
  return items.length ? Math.max(...items.map((x) => Number(x.id) || 0)) + 1 : start;
}

function sanitizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  const allowedTypes = new Set(['text', 'number', 'select', 'date', 'boolean', 'table']);
  const usedFieldNames = new Set();

  return fields.map((f, idx) => {
    const label = String(f.label || `Field ${idx + 1}`).trim() || `Field ${idx + 1}`;
    const baseName =
      String(f.fieldName || label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `field_${idx + 1}`;
    let fieldName = baseName;
    let suffix = 2;
    while (usedFieldNames.has(fieldName)) {
      fieldName = `${baseName}_${suffix++}`;
    }
    usedFieldNames.add(fieldName);

    const type = allowedTypes.has(f.type) ? f.type : 'text';
    const options =
      type === 'select' && Array.isArray(f.options)
        ? f.options.map((o) => String(o).trim()).filter(Boolean)
        : [];

    const usedColNames = new Set();
    const columns =
      type === 'table' && Array.isArray(f.columns)
        ? f.columns.map((c, cIdx) => {
            const colBase =
              String(c.name || c.label || `col_${cIdx + 1}`)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '') || `col_${cIdx + 1}`;
            let colName = colBase;
            let colSuffix = 2;
            while (usedColNames.has(colName)) {
              colName = `${colBase}_${colSuffix++}`;
            }
            usedColNames.add(colName);
            const colType =
              c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text';
            return {
              id: c.id || `col_${Date.now()}_${cIdx}`,
              name: colName,
              label: String(c.label || `Column ${cIdx + 1}`).trim() || `Column ${cIdx + 1}`,
              type: colType,
              required: Boolean(c.required),
            };
          })
        : [];

    return {
      id: f.id || `f_${Date.now()}_${idx}`,
      fieldName,
      label,
      type,
      required: Boolean(f.required),
      options,
      columns,
    };
  });
}

const MONEY_COLUMN_REGEX =
  /\b(pay|payment|payments|salary|wage|wages|amount|amt|fee|fees|cost|price|rate|total|bill|charge|charges|rent|bonus|advance|balance|expense|expenses|income|revenue|rs|inr|rupee|rupees|money|cash|paid|due|stipend|commission|discount|tax|subtotal|payable|receivable|deposit)\b/i;

const NON_SUMMABLE_NUMERIC_REGEX =
  /\b(age|phone|mobile|contact|year|pin|pincode|zip|code|aadhaar|pan|gst|serial|sr|roll|id|no|number)\b/i;

function normalizeColumnMeta(col) {
  const nameText = String(col.name || '').replace(/_/g, ' ');
  const labelText = String(col.label || '');
  const combined = `${labelText} ${nameText}`.trim();
  const isNumber = col.type === 'number';
  const isMoney = isNumber && MONEY_COLUMN_REGEX.test(combined);
  const isNonSummable = isNumber && !isMoney && NON_SUMMABLE_NUMERIC_REGEX.test(combined);
  const isSummable = isNumber && (isMoney || !isNonSummable);
  return {
    id: col.id || col.name,
    name: col.name,
    label: col.label,
    type: col.type === 'number' ? 'number' : 'text',
    isMoney,
    isSummable,
  };
}

function getRecordEffectiveDate(rec) {
  const raw = rec?.payment?.paidAt || rec?.createdAt || '';
  if (!raw) return '';
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes('T')) {
    const dt = new Date(str);
    if (!Number.isNaN(dt.getTime())) return getLocalDateStr(dt);
  }
  return str.slice(0, 10);
}

function isValidIsoDate(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function isRowPopulatedServer(row, columns) {
  if (!row || typeof row !== 'object') return false;
  if (columns.length > 0) {
    return columns.some((c) => {
      const val = row[c.name];
      return val !== '' && val !== undefined && val !== null && String(val).trim() !== '';
    });
  }
  return Object.values(row).some(
    (val) => val !== '' && val !== undefined && val !== null && String(val).trim() !== ''
  );
}

function getRecordTitleServer(record, business) {
  if (!record) return 'Record';
  const legacyName = String(record.customerName || '').trim();
  if (legacyName) return legacyName;
  const fields = business?.fields || [];
  const answers = record.answers || {};
  for (const f of fields) {
    if (f.type === 'table' || f.type === 'boolean') continue;
    const val = answers[f.fieldName];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return `${f.label}: ${String(val).trim()}`;
    }
  }
  for (const [k, v] of Object.entries(answers)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      const matched = fields.find((f) => f.fieldName === k);
      const label = matched?.label || k;
      if (typeof v === 'boolean') return `${label}: ${v ? 'Yes' : 'No'}`;
      return `${label}: ${String(v).trim()}`;
    }
  }
  return `Registration #${record.id}`;
}

export function handleWorkspaceRequest(method, urlPath, queryParams, body, authHeader) {
  const isWorkspaceRoute =
    urlPath.startsWith('/api/businesses') ||
    urlPath.startsWith('/api/records') ||
    urlPath.startsWith('/api/reports') ||
    urlPath.startsWith('/api/profile') ||
    urlPath.startsWith('/api/settings') ||
    urlPath.startsWith('/api/tickets') ||
    urlPath.startsWith('/api/search');

  if (!isWorkspaceRoute) return null;

  const user = getAuthenticatedUser(authHeader);
  if (!user) {
    return { status: 401, data: { message: 'Authentication required. Please sign in again.' } };
  }

  const store = readWorkspace();
  pruneExpiredRecycleBin(store);

  // ---------------- BUSINESSES ----------------
  if (method === 'GET' && urlPath === '/api/businesses') {
    const businesses = store.businesses.filter((b) => b.userId === user.id && !b.deletedAt);
    return { status: 200, data: { businesses } };
  }

  if (method === 'GET' && urlPath === '/api/businesses/recycle-bin') {
    const now = Date.now();
    const deletedBusinesses = store.businesses
      .filter((b) => b.userId === user.id && Boolean(b.deletedAt))
      .map((b) => {
        const elapsedDays = Math.floor((now - new Date(b.deletedAt).getTime()) / (24 * 60 * 60 * 1000));
        const remainingDays = Math.max(0, 30 - elapsedDays);
        const recordCount = store.records.filter(
          (r) => r.userId === user.id && r.businessId === b.id && Boolean(r.deletedAt)
        ).length;
        return {
          ...b,
          remainingDays,
          recordCount,
        };
      })
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return { status: 200, data: { businesses: deletedBusinesses } };
  }

  if (method === 'POST' && urlPath === '/api/businesses') {
    const name = String(body?.name || '').trim();
    const bizEmail = String(body?.email || '').trim();
    if (name.length < 2) {
      return { status: 400, data: { message: 'Business name must be at least 2 characters.' } };
    }
    if (bizEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bizEmail)) {
      return { status: 400, data: { message: 'Please enter a valid business email address.' } };
    }
    const lowerName = name.toLowerCase();
    if (
      store.businesses.some(
        (b) => b.userId === user.id && !b.deletedAt && String(b.name || '').trim().toLowerCase() === lowerName
      )
    ) {
      return { status: 409, data: { message: 'A business with this name already exists.' } };
    }
    const now = new Date().toISOString();
    const business = {
      id: nextId(store.businesses, 100),
      userId: user.id,
      name,
      category: String(body?.category || 'General Services').trim() || 'General Services',
      phone: String(body?.phone || '').trim(),
      email: bizEmail,
      address: String(body?.address || '').trim(),
      description: String(body?.description || '').trim(),
      archived: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      fields: sanitizeFields(body?.fields || []),
    };
    store.businesses.push(business);
    writeWorkspace(store);
    return { status: 201, data: { business, message: 'Business created successfully.' } };
  }

  const bizArchiveMatch = urlPath.match(/^\/api\/businesses\/(\d+)\/archive$/);
  if (method === 'POST' && bizArchiveMatch) {
    const bizId = Number(bizArchiveMatch[1]);
    const idx = store.businesses.findIndex((b) => b.id === bizId && b.userId === user.id && !b.deletedAt);
    if (idx === -1) {
      return { status: 404, data: { message: 'Business not found.' } };
    }
    store.businesses[idx] = {
      ...store.businesses[idx],
      archived: true,
      updatedAt: new Date().toISOString(),
    };
    writeWorkspace(store);
    return { status: 200, data: { business: store.businesses[idx], message: 'Business archived.' } };
  }

  const bizRestoreMatch = urlPath.match(/^\/api\/businesses\/(\d+)\/restore$/);
  if (method === 'POST' && bizRestoreMatch) {
    const bizId = Number(bizRestoreMatch[1]);
    const idx = store.businesses.findIndex((b) => b.id === bizId && b.userId === user.id);
    if (idx === -1) {
      return { status: 404, data: { message: 'Business not found.' } };
    }
    const existing = store.businesses[idx];
    const now = new Date().toISOString();
    if (existing.deletedAt) {
      const existingLower = String(existing.name || '').trim().toLowerCase();
      if (
        store.businesses.some(
          (b) =>
            b.id !== bizId &&
            b.userId === user.id &&
            !b.deletedAt &&
            String(b.name || '').trim().toLowerCase() === existingLower
        )
      ) {
        return {
          status: 409,
          data: { message: 'A business with this name already exists. Rename the active business before restoring.' },
        };
      }
      store.businesses[idx] = {
        ...existing,
        deletedAt: null,
        updatedAt: now,
      };
      store.records.forEach((r, rIdx) => {
        if (
          r.userId === user.id &&
          r.businessId === bizId &&
          r.deletedAt &&
          r.deletedAt === existing.deletedAt
        ) {
          store.records[rIdx] = { ...r, deletedAt: null, updatedAt: now };
        }
      });
      writeWorkspace(store);
      return {
        status: 200,
        data: { business: store.businesses[idx], message: 'Business restored from Recycle Bin.' },
      };
    }
    store.businesses[idx] = {
      ...existing,
      archived: false,
      updatedAt: now,
    };
    writeWorkspace(store);
    return {
      status: 200,
      data: { business: store.businesses[idx], message: 'Business restored to Active.' },
    };
  }

  const bizPermMatch = urlPath.match(/^\/api\/businesses\/(\d+)\/permanent$/);
  if (method === 'DELETE' && bizPermMatch) {
    const bizId = Number(bizPermMatch[1]);
    const idx = store.businesses.findIndex((b) => b.id === bizId && b.userId === user.id);
    if (idx === -1) {
      return { status: 404, data: { message: 'Business not found.' } };
    }
    store.businesses.splice(idx, 1);
    store.records = store.records.filter(
      (r) => !(r.userId === user.id && r.businessId === bizId)
    );
    writeWorkspace(store);
    return { status: 200, data: { message: 'Business permanently deleted.' } };
  }

  const bizMatch = urlPath.match(/^\/api\/businesses\/(\d+)$/);
  if (bizMatch) {
    const bizId = Number(bizMatch[1]);
    const idx = store.businesses.findIndex((b) => b.id === bizId && b.userId === user.id && !b.deletedAt);
    if (idx === -1) {
      return { status: 404, data: { message: 'Business not found.' } };
    }

    if (method === 'GET') {
      return { status: 200, data: { business: store.businesses[idx] } };
    }

    if (method === 'PUT') {
      const existing = store.businesses[idx];
      const nextName = body?.name !== undefined ? String(body.name).trim() : existing.name;
      if (nextName.length < 2) {
        return { status: 400, data: { message: 'Business name must be at least 2 characters.' } };
      }
      const nextNameLower = nextName.toLowerCase();
      if (
        store.businesses.some(
          (b) =>
            b.id !== bizId &&
            b.userId === user.id &&
            !b.deletedAt &&
            String(b.name || '').trim().toLowerCase() === nextNameLower
        )
      ) {
        return { status: 409, data: { message: 'A business with this name already exists.' } };
      }
      const nextEmail = body?.email !== undefined ? String(body.email).trim() : existing.email;
      if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return { status: 400, data: { message: 'Please enter a valid business email address.' } };
      }
      const updated = {
        ...existing,
        name: nextName,
        category:
          body?.category !== undefined
            ? String(body.category || 'General Services').trim() || 'General Services'
            : existing.category,
        phone: body?.phone !== undefined ? String(body.phone).trim() : existing.phone,
        email: nextEmail,
        address: body?.address !== undefined ? String(body.address).trim() : existing.address,
        description: body?.description !== undefined ? String(body.description).trim() : existing.description,
        archived: body?.archived !== undefined ? Boolean(body.archived) : existing.archived,
        fields: body?.fields !== undefined ? sanitizeFields(body.fields) : existing.fields,
        updatedAt: new Date().toISOString(),
      };
      store.businesses[idx] = updated;
      writeWorkspace(store);
      return { status: 200, data: { business: updated, message: 'Business updated.' } };
    }

    if (method === 'DELETE') {
      const now = new Date().toISOString();
      store.businesses[idx] = {
        ...store.businesses[idx],
        deletedAt: now,
        updatedAt: now,
      };
      let movedRecordCount = 0;
      store.records.forEach((r, rIdx) => {
        if (r.userId === user.id && r.businessId === bizId && !r.deletedAt) {
          store.records[rIdx] = { ...r, deletedAt: now, updatedAt: now };
          movedRecordCount += 1;
        }
      });
      writeWorkspace(store);
      return {
        status: 200,
        data: {
          message: 'Business moved to Recycle Bin (retained for 30 days).',
          movedRecordCount,
        },
      };
    }
  }

  // ---------------- CUSTOMER RECORDS & RECYCLE BIN ----------------
  if (method === 'GET' && urlPath === '/api/records') {
    const records = store.records
      .filter((r) => r.userId === user.id && !r.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { status: 200, data: { records } };
  }

  if (method === 'GET' && urlPath === '/api/records/recycle-bin') {
    const now = Date.now();
    const deletedRecords = store.records
      .filter((r) => r.userId === user.id && Boolean(r.deletedAt))
      .map((r) => {
        const elapsedDays = Math.floor((now - new Date(r.deletedAt).getTime()) / (24 * 60 * 60 * 1000));
        const remainingDays = Math.max(0, 30 - elapsedDays);
        const biz = store.businesses.find((b) => b.id === r.businessId && b.userId === user.id);
        return {
          ...r,
          businessName: biz?.name || 'Deleted Business',
          remainingDays,
        };
      })
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return { status: 200, data: { records: deletedRecords } };
  }

  if (method === 'POST' && urlPath === '/api/records') {
    const businessId = Number(body?.businessId);
    const biz = store.businesses.find((b) => b.id === businessId && b.userId === user.id && !b.deletedAt);
    if (!biz) {
      return { status: 400, data: { message: 'Please select a valid business.' } };
    }

    const customerName = String(body?.customerName || '').trim();
    const customerPhone = String(body?.customerPhone || '').trim();
    const customerEmail = String(body?.customerEmail || '').trim();
    const answers = body?.answers && typeof body.answers === 'object' ? body.answers : {};
    const repeatingTables =
      body?.repeatingTables && typeof body.repeatingTables === 'object' ? body.repeatingTables : {};

    for (const field of biz.fields || []) {
      if (!field.required) continue;
      if (field.type === 'table') {
        const rows = Array.isArray(repeatingTables[field.fieldName])
          ? repeatingTables[field.fieldName]
          : [];
        const hasValidRow = rows.some((r) =>
          r &&
          typeof r === 'object' &&
          Object.values(r).some((v) => v !== '' && v !== null && v !== undefined && String(v).trim() !== '')
        );
        if (!hasValidRow) {
          return {
            status: 400,
            data: { message: `${field.label} requires at least one populated row.` },
          };
        }
      } else if (field.type === 'boolean') {
        if (answers[field.fieldName] === undefined || answers[field.fieldName] === null) {
          return {
            status: 400,
            data: { message: `Please select Yes or No for ${field.label}.` },
          };
        }
      } else {
        const val = answers[field.fieldName];
        if (val === undefined || val === null || String(val).trim() === '') {
          return { status: 400, data: { message: `${field.label} is required.` } };
        }
      }
    }

    const payment = body?.payment || {};
    const amount = Number(payment.amount);
    if (payment.amount === '' || payment.amount === undefined || payment.amount === null || Number.isNaN(amount) || amount < 0) {
      return { status: 400, data: { message: 'Payment amount must be 0 or greater.' } };
    }
    const methodPay = payment.method === 'Online' ? 'Online' : 'Cash';
    const transactionId = String(payment.transactionId || '').trim();
    if (methodPay === 'Online' && !transactionId) {
      return { status: 400, data: { message: 'Transaction ID is required for Online payments.' } };
    }
    if (methodPay === 'Online' && transactionId) {
      const txnLower = transactionId.toLowerCase();
      const dupTxn = store.records.find(
        (r) =>
          r.userId === user.id &&
          !r.deletedAt &&
          r.payment?.method === 'Online' &&
          String(r.payment?.transactionId || '').trim().toLowerCase() === txnLower
      );
      if (dupTxn) {
        return {
          status: 409,
          data: { message: 'A customer record with this Transaction ID already exists.' },
        };
      }
    }

    const paidAtStr = String(payment.paidAt || getLocalDateStr());
    const incomingPayment = {
      amount,
      method: methodPay,
      transactionId: methodPay === 'Online' ? transactionId : '',
      paidAt: paidAtStr,
    };
    const incomingFingerprint = stableJson({
      businessId,
      customerName,
      customerPhone,
      customerEmail,
      answers,
      repeatingTables,
      payment: incomingPayment,
    });
    const nowMs = Date.now();
    const rapidDuplicate = store.records.find((r) => {
      if (r.userId !== user.id || r.deletedAt || r.businessId !== businessId) return false;
      const createdMs = new Date(r.createdAt).getTime();
      if (Number.isNaN(createdMs) || nowMs - createdMs > DUPLICATE_SUBMISSION_WINDOW_MS) return false;
      const existingFingerprint = stableJson({
        businessId: r.businessId,
        customerName: r.customerName || '',
        customerPhone: r.customerPhone || '',
        customerEmail: r.customerEmail || '',
        answers: r.answers || {},
        repeatingTables: r.repeatingTables || {},
        payment: r.payment || {},
      });
      return existingFingerprint === incomingFingerprint;
    });
    if (rapidDuplicate) {
      return {
        status: 409,
        data: { message: 'Duplicate submission detected. This customer registration was already saved.' },
      };
    }

    const now = new Date(nowMs).toISOString();
    const record = {
      id: nextId(store.records, 1000),
      userId: user.id,
      businessId,
      customerName,
      customerPhone,
      customerEmail,
      answers,
      repeatingTables,
      payment: incomingPayment,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    store.records.push(record);
    writeWorkspace(store);
    return { status: 201, data: { record, message: 'Registration saved successfully.' } };
  }

  const restoreMatch = urlPath.match(/^\/api\/records\/(\d+)\/restore$/);
  if (method === 'POST' && restoreMatch) {
    const recId = Number(restoreMatch[1]);
    const rec = store.records.find((r) => r.id === recId && r.userId === user.id && r.deletedAt);
    if (!rec) {
      return { status: 404, data: { message: 'Deleted record not found in Recycle Bin.' } };
    }
    const parentBiz = store.businesses.find(
      (b) => b.id === rec.businessId && b.userId === user.id && !b.deletedAt
    );
    if (!parentBiz) {
      return {
        status: 400,
        data: { message: 'Restore the parent business first before restoring this record.' },
      };
    }
    rec.deletedAt = null;
    rec.updatedAt = new Date().toISOString();
    writeWorkspace(store);
    return { status: 200, data: { record: rec, message: 'Customer record restored.' } };
  }

  const permMatch = urlPath.match(/^\/api\/records\/(\d+)\/permanent$/);
  if (method === 'DELETE' && permMatch) {
    const recId = Number(permMatch[1]);
    const idx = store.records.findIndex((r) => r.id === recId && r.userId === user.id && r.deletedAt);
    if (idx === -1) {
      return { status: 404, data: { message: 'Deleted record not found.' } };
    }
    store.records.splice(idx, 1);
    writeWorkspace(store);
    return { status: 200, data: { message: 'Record permanently deleted.' } };
  }

  const recMatch = urlPath.match(/^\/api\/records\/(\d+)$/);
  if (recMatch) {
    const recId = Number(recMatch[1]);
    const idx = store.records.findIndex((r) => r.id === recId && r.userId === user.id && !r.deletedAt);
    if (idx === -1) {
      return { status: 404, data: { message: 'Record not found.' } };
    }

    if (method === 'PUT') {
      const existing = store.records[idx];
      const biz = store.businesses.find((b) => b.id === existing.businessId && b.userId === user.id);
      const nextCustomerName =
        body?.customerName !== undefined ? String(body.customerName).trim() : existing.customerName;
      const nextAnswers =
        body?.answers && typeof body.answers === 'object'
          ? body.answers
          : existing.answers;
      const nextRepeatingTables =
        body?.repeatingTables && typeof body.repeatingTables === 'object'
          ? body.repeatingTables
          : existing.repeatingTables;

      for (const field of biz?.fields || []) {
        if (!field.required) continue;
        if (field.type === 'table') {
          const rows = Array.isArray(nextRepeatingTables?.[field.fieldName])
            ? nextRepeatingTables[field.fieldName]
            : [];
          const hasValidRow = rows.some((r) =>
            r &&
            typeof r === 'object' &&
            Object.values(r).some((v) => v !== '' && v !== null && v !== undefined && String(v).trim() !== '')
          );
          if (!hasValidRow) {
            return {
              status: 400,
              data: { message: `${field.label} requires at least one populated row.` },
            };
          }
        } else if (field.type === 'boolean') {
          if (nextAnswers?.[field.fieldName] === undefined || nextAnswers?.[field.fieldName] === null) {
            return {
              status: 400,
              data: { message: `Please select Yes or No for ${field.label}.` },
            };
          }
        } else {
          const val = nextAnswers?.[field.fieldName];
          if (val === undefined || val === null || String(val).trim() === '') {
            return { status: 400, data: { message: `${field.label} is required.` } };
          }
        }
      }

      const payment = body?.payment || existing.payment;
      const amount = Number(payment.amount);
      if (payment.amount === '' || payment.amount === undefined || payment.amount === null || Number.isNaN(amount) || amount < 0) {
        return { status: 400, data: { message: 'Payment amount must be 0 or greater.' } };
      }
      const methodPay = payment.method === 'Online' ? 'Online' : 'Cash';
      const transactionId = String(payment.transactionId || '').trim();
      if (methodPay === 'Online' && !transactionId) {
        return { status: 400, data: { message: 'Transaction ID is required for Online payments.' } };
      }
      if (methodPay === 'Online' && transactionId) {
        const txnLower = transactionId.toLowerCase();
        const dupTxn = store.records.find(
          (r) =>
            r.id !== recId &&
            r.userId === user.id &&
            !r.deletedAt &&
            r.payment?.method === 'Online' &&
            String(r.payment?.transactionId || '').trim().toLowerCase() === txnLower
        );
        if (dupTxn) {
          return {
            status: 409,
            data: { message: 'A customer record with this Transaction ID already exists.' },
          };
        }
      }

      const updated = {
        ...existing,
        customerName: nextCustomerName,
        customerPhone:
          body?.customerPhone !== undefined ? String(body.customerPhone).trim() : existing.customerPhone,
        customerEmail:
          body?.customerEmail !== undefined ? String(body.customerEmail).trim() : existing.customerEmail,
        answers: nextAnswers,
        repeatingTables: nextRepeatingTables,
        payment: {
          amount,
          method: methodPay,
          transactionId: methodPay === 'Online' ? transactionId : '',
          paidAt: String(payment.paidAt || existing.payment?.paidAt || getLocalDateStr()),
        },
        updatedAt: new Date().toISOString(),
      };
      store.records[idx] = updated;
      writeWorkspace(store);
      return { status: 200, data: { record: updated, message: 'Customer record updated.' } };
    }

    if (method === 'DELETE') {
      store.records[idx].deletedAt = new Date().toISOString();
      store.records[idx].updatedAt = new Date().toISOString();
      writeWorkspace(store);
      return {
        status: 200,
        data: { message: 'Record moved to Recycle Bin (retained for 30 days).' },
      };
    }
  }

  // ---------------- PROFILE ----------------
  if (method === 'GET' && urlPath === '/api/profile') {
    return { status: 200, data: { profile: sanitizeUser(user) } };
  }

  if (method === 'PUT' && urlPath === '/api/profile') {
    const authStore = readAuthStore();
    const uIdx = authStore.users.findIndex((u) => u.id === user.id);
    if (uIdx === -1) return { status: 404, data: { message: 'User not found.' } };

    const fullName = String(body?.fullName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();
    const aadhaar = String(body?.aadhaar || '').replace(/\s+/g, '');
    const photoDataUrl =
      body?.photoDataUrl !== undefined ? String(body.photoDataUrl) : authStore.users[uIdx].photoDataUrl;

    if (fullName.length < 2) {
      return { status: 400, data: { message: 'Full name must be at least 2 characters.' } };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { status: 400, data: { message: 'Please provide a valid email address.' } };
    }
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      return { status: 400, data: { message: 'Aadhaar number must be exactly 12 digits.' } };
    }
    if (
      authStore.users.some((u) => u.email === email && u.id !== user.id)
    ) {
      return { status: 409, data: { message: 'Email is already in use by another account.' } };
    }

    authStore.users[uIdx] = {
      ...authStore.users[uIdx],
      fullName,
      email,
      phone,
      aadhaar,
      photoDataUrl,
    };
    writeAuthStore(authStore);
    return {
      status: 200,
      data: {
        profile: sanitizeUser(authStore.users[uIdx]),
        message: 'Account profile updated.',
      },
    };
  }

  if (method === 'POST' && urlPath === '/api/profile/change-password') {
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    if (!currentPassword || !isStrongPassword(newPassword)) {
      return {
        status: 400,
        data: {
          message:
            'Current password is required and new password must be at least 8 characters with letters and numbers.',
        },
      };
    }

    const authStore = readAuthStore();
    const uIdx = authStore.users.findIndex((u) => u.id === user.id);
    if (uIdx === -1) return { status: 404, data: { message: 'User not found.' } };

    if (!verifyPassword(currentPassword, authStore.users[uIdx].passwordHash)) {
      return { status: 400, data: { message: 'Current password is incorrect.' } };
    }

    authStore.users[uIdx].passwordHash = hashPassword(newPassword);
    writeAuthStore(authStore);
    return { status: 200, data: { message: 'Password updated successfully.' } };
  }

  // ---------------- SETTINGS & BACKUP ----------------
  if (method === 'GET' && urlPath === '/api/settings') {
    const settings = getOrCreateUserSettings(store, user.id);
    return { status: 200, data: { settings } };
  }

  if (method === 'PUT' && urlPath === '/api/settings') {
    const settings = getOrCreateUserSettings(store, user.id);
    settings.language = body?.language === 'te' ? 'te' : 'en';
    if (body?.phoneAlerts !== undefined) settings.phoneAlerts = Boolean(body.phoneAlerts);
    if (body?.emailReceipts !== undefined) settings.emailReceipts = Boolean(body.emailReceipts);
    if (body?.twoFactorOtp !== undefined) settings.twoFactorOtp = Boolean(body.twoFactorOtp);
    if (body?.dailyBackup !== undefined) settings.dailyBackup = Boolean(body.dailyBackup);
    writeWorkspace(store);
    return { status: 200, data: { settings, message: 'Settings saved successfully.' } };
  }

  if (method === 'POST' && urlPath === '/api/settings/backup-now') {
    const settings = getOrCreateUserSettings(store, user.id);
    settings.lastBackupAt = new Date().toISOString();
    writeWorkspace(store);
    const snapshot = {
      exportedAt: settings.lastBackupAt,
      owner: sanitizeUser(user),
      businesses: store.businesses.filter((b) => b.userId === user.id && !b.deletedAt),
      records: store.records.filter((r) => r.userId === user.id),
      tickets: store.tickets.filter((t) => t.userId === user.id),
      settings,
    };
    return {
      status: 200,
      data: { settings, snapshot, message: 'Workspace backup created.' },
    };
  }

  // ---------------- SUPPORT TICKETS ----------------
  if (method === 'GET' && urlPath === '/api/tickets') {
    const tickets = store.tickets
      .filter((t) => t.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { status: 200, data: { tickets } };
  }

  if (method === 'POST' && urlPath === '/api/tickets') {
    const subject = String(body?.subject || '').trim();
    const description = String(body?.description || '').trim();
    const category = String(body?.category || 'General Support').trim();
    if (subject.length < 3 || description.length < 10) {
      return {
        status: 400,
        data: { message: 'Please enter a subject and a description of at least 10 characters.' },
      };
    }
    const now = new Date().toISOString();
    const ticket = {
      id: nextId(store.tickets, 500),
      userId: user.id,
      subject,
      category,
      description,
      status: 'Open',
      createdAt: now,
      updatedAt: now,
    };
    store.tickets.push(ticket);
    writeWorkspace(store);
    return { status: 201, data: { ticket, message: 'Support ticket submitted.' } };
  }

  const ticketMatch = urlPath.match(/^\/api\/tickets\/(\d+)$/);
  if (method === 'PATCH' && ticketMatch) {
    const ticketId = Number(ticketMatch[1]);
    const ticket = store.tickets.find((t) => t.id === ticketId && t.userId === user.id);
    if (!ticket) return { status: 404, data: { message: 'Ticket not found.' } };
    const allowed = ['Open', 'In Progress', 'Resolved'];
    if (allowed.includes(body?.status)) {
      ticket.status = body.status;
      ticket.updatedAt = new Date().toISOString();
      writeWorkspace(store);
    }
    return { status: 200, data: { ticket } };
  }

  // ---------------- GLOBAL SEARCH ----------------
  if (method === 'GET' && urlPath === '/api/search') {
    const q = String(queryParams?.get('q') || '').trim().toLowerCase();
    if (!q) {
      return { status: 200, data: { businesses: [], customers: [], tickets: [] } };
    }

    const userBusinesses = store.businesses.filter((b) => b.userId === user.id && !b.deletedAt);
    const matchedBusinesses = userBusinesses.filter((b) =>
      [b.name, b.category, b.phone, b.email, b.address].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );

    const matchedCustomers = store.records
      .filter((r) => r.userId === user.id && !r.deletedAt)
      .filter((r) => {
        const answersText = Object.values(r.answers || {}).join(' ');
        const tablesText = JSON.stringify(r.repeatingTables || {});
        return [
          r.customerName,
          r.customerPhone,
          r.customerEmail,
          r.payment?.transactionId,
          answersText,
          tablesText,
        ].some((v) => String(v || '').toLowerCase().includes(q));
      })
      .map((r) => ({
        ...r,
        businessName: userBusinesses.find((b) => b.id === r.businessId)?.name || 'Business',
      }));

    const matchedTickets = store.tickets
      .filter((t) => t.userId === user.id)
      .filter((t) =>
        [t.subject, t.description, t.category, t.status].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )
      );

    return {
      status: 200,
      data: {
        businesses: matchedBusinesses.slice(0, 8),
        customers: matchedCustomers.slice(0, 10),
        tickets: matchedTickets.slice(0, 6),
      },
    };
  }

  // ---------------- REPORTS ----------------
  if (method === 'GET' && urlPath === '/api/reports/table-records') {
    const rawBusinessId = String(queryParams?.get('businessId') || '').trim();
    const tableField = String(queryParams?.get('tableField') || '').trim();
    const searchQuery = String(queryParams?.get('q') || '').trim();
    const startDate = String(queryParams?.get('startDate') || '').trim();
    const endDate = String(queryParams?.get('endDate') || '').trim();
    const page = Math.max(1, parseInt(queryParams?.get('page') || '1', 10) || 1);
    const requestedSize = parseInt(queryParams?.get('pageSize') || '25', 10) || 25;
    const pageSize = Math.min(5000, Math.max(1, requestedSize));

    if (!rawBusinessId || !/^\d+$/.test(rawBusinessId)) {
      return { status: 400, data: { message: 'Please select a valid form.' } };
    }
    if (startDate && !isValidIsoDate(startDate)) {
      return { status: 400, data: { message: 'Invalid start date format.' } };
    }
    if (endDate && !isValidIsoDate(endDate)) {
      return { status: 400, data: { message: 'Invalid end date format.' } };
    }
    if (startDate && endDate && startDate > endDate) {
      return { status: 400, data: { message: 'Start date cannot be after end date.' } };
    }

    const bizId = Number(rawBusinessId);
    const biz = store.businesses.find((b) => b.id === bizId && b.userId === user.id && !b.deletedAt);
    if (!biz) {
      return { status: 404, data: { message: 'Selected form was not found.' } };
    }

    const tableFields = (biz.fields || []).filter((f) => f.type === 'table');
    if (tableFields.length === 0) {
      return {
        status: 200,
        data: {
          business: { id: biz.id, name: biz.name, archived: Boolean(biz.archived) },
          table: null,
          filters: { startDate, endDate, q: searchQuery },
          rows: [],
          totals: {},
          moneyTotal: 0,
          hasMoneyColumns: false,
          pagination: { page: 1, pageSize, totalRows: 0, totalPages: 1 },
        },
      };
    }

    const targetField = tableField
      ? tableFields.find((f) => f.fieldName === tableField)
      : tableFields[0];

    if (!targetField) {
      return {
        status: 404,
        data: { message: 'Selected repeating table does not exist on this form.' },
      };
    }

    const columns = (Array.isArray(targetField.columns) ? targetField.columns : []).map(
      normalizeColumnMeta
    );
    const qLower = searchQuery.toLowerCase();

    const scopedRecords = store.records
      .filter((r) => {
        if (r.userId !== user.id || r.deletedAt || r.businessId !== biz.id) return false;
        const dStr = getRecordEffectiveDate(r);
        if (startDate && (!dStr || dStr < startDate)) return false;
        if (endDate && (!dStr || dStr > endDate)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = getRecordEffectiveDate(a);
        const db = getRecordEffectiveDate(b);
        if (da !== db) return da.localeCompare(db);
        return Number(a.id) - Number(b.id);
      });

    const totals = {};
    columns.forEach((col) => {
      if (col.isSummable) totals[col.name] = 0;
    });

    const seenKeys = new Set();
    const matchedRows = [];

    scopedRecords.forEach((rec) => {
      const rawTableRows = Array.isArray(rec.repeatingTables?.[targetField.fieldName])
        ? rec.repeatingTables[targetField.fieldName]
        : [];
      const rowDate = getRecordEffectiveDate(rec);

      rawTableRows.forEach((rowObj, rowIdx) => {
        if (!isRowPopulatedServer(rowObj, columns)) return;

        // Search strictly inside this repeating table's configured columns only
        if (qLower) {
          const matchesRow = columns.some((col) => {
            const val = rowObj[col.name];
            if (val === undefined || val === null) return false;
            return String(val).toLowerCase().includes(qLower);
          });
          if (!matchesRow) return;
        }

        const uniqueKey = `${rec.id}:${targetField.fieldName}:${rowIdx}`;
        if (seenKeys.has(uniqueKey)) return;
        seenKeys.add(uniqueKey);

        const cells = {};
        columns.forEach((col) => {
          const rawVal = rowObj[col.name];
          cells[col.name] = rawVal !== undefined && rawVal !== null ? rawVal : '';
          if (col.isSummable && rawVal !== '' && rawVal !== undefined && rawVal !== null) {
            const num = Number(rawVal);
            if (!Number.isNaN(num)) {
              totals[col.name] = Number((totals[col.name] + num).toFixed(2));
            }
          }
        });

        matchedRows.push({
          id: uniqueKey,
          recordId: rec.id,
          date: rowDate,
          cells,
        });
      });
    });

    const moneyColumns = columns.filter((c) => c.isMoney);
    const hasMoneyColumns = moneyColumns.length > 0;
    const moneyTotal = Number(
      moneyColumns.reduce((acc, c) => acc + (Number(totals[c.name]) || 0), 0).toFixed(2)
    );

    const totalRows = matchedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pagedRows = matchedRows.slice(startIdx, startIdx + pageSize);

    return {
      status: 200,
      data: {
        business: { id: biz.id, name: biz.name, archived: Boolean(biz.archived) },
        table: {
          fieldName: targetField.fieldName,
          label: targetField.label,
          columns,
        },
        filters: { startDate, endDate, q: searchQuery },
        rows: pagedRows,
        totals,
        moneyTotal,
        hasMoneyColumns,
        pagination: {
          page: safePage,
          pageSize,
          totalRows,
          totalPages,
        },
      },
    };
  }

  if (method === 'GET' && urlPath === '/api/reports/overview') {
    const rawBusinessId = String(queryParams?.get('businessId') || 'all').trim();
    const startDate = String(queryParams?.get('startDate') || '').trim();
    const endDate = String(queryParams?.get('endDate') || '').trim();
    const paymentMethod = String(queryParams?.get('paymentMethod') || 'all').trim();
    const searchQuery = String(queryParams?.get('q') || '').trim();
    const page = Math.max(1, parseInt(queryParams?.get('page') || '1', 10) || 1);
    const requestedSize = parseInt(queryParams?.get('pageSize') || '25', 10) || 25;
    const pageSize = Math.min(5000, Math.max(1, requestedSize));

    if (rawBusinessId !== 'all' && !/^\d+$/.test(rawBusinessId)) {
      return { status: 400, data: { message: 'Invalid business filter.' } };
    }
    if (startDate && !isValidIsoDate(startDate)) {
      return { status: 400, data: { message: 'Invalid start date format.' } };
    }
    if (endDate && !isValidIsoDate(endDate)) {
      return { status: 400, data: { message: 'Invalid end date format.' } };
    }
    if (startDate && endDate && startDate > endDate) {
      return { status: 400, data: { message: 'Start date cannot be after end date.' } };
    }

    const userBusinesses = store.businesses.filter((b) => b.userId === user.id && !b.deletedAt);
    const bizMap = Object.fromEntries(userBusinesses.map((b) => [b.id, b]));
    const selectedBizId = rawBusinessId === 'all' ? null : Number(rawBusinessId);
    const selectedBiz = selectedBizId ? bizMap[selectedBizId] || null : null;

    if (selectedBizId && !selectedBiz) {
      return { status: 404, data: { message: 'Selected form was not found.' } };
    }

    const qLower = searchQuery.toLowerCase();
    const seenRecIds = new Set();

    const filteredRecords = store.records
      .filter((r) => {
        if (r.userId !== user.id || r.deletedAt) return false;
        if (!bizMap[r.businessId]) return false;
        if (selectedBizId && r.businessId !== selectedBizId) return false;
        const dStr = getRecordEffectiveDate(r);
        if (startDate && (!dStr || dStr < startDate)) return false;
        if (endDate && (!dStr || dStr > endDate)) return false;

        const methodVal = r.payment?.method === 'Online' ? 'Online' : 'Cash';
        if (paymentMethod === 'Cash' && methodVal !== 'Cash') return false;
        if (paymentMethod === 'Online' && methodVal !== 'Online') return false;

        if (qLower) {
          const biz = bizMap[r.businessId];
          const title = getRecordTitleServer(r, biz);
          const answersStr = Object.values(r.answers || {}).join(' ');
          const haystack = [
            title,
            r.customerName,
            r.customerPhone,
            r.customerEmail,
            biz?.name,
            r.payment?.transactionId,
            methodVal,
            answersStr,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(qLower)) return false;
        }

        if (seenRecIds.has(r.id)) return false;
        seenRecIds.add(r.id);
        return true;
      })
      .sort((a, b) => {
        const da = getRecordEffectiveDate(a);
        const db = getRecordEffectiveDate(b);
        if (da !== db) return db.localeCompare(da);
        return Number(b.id) - Number(a.id);
      });

    let totalAmount = 0;
    let cashCount = 0;
    let cashAmount = 0;
    let onlineCount = 0;
    let onlineAmount = 0;
    let totalRepeatingEntries = 0;

    filteredRecords.forEach((r) => {
      const amt = Number(r.payment?.amount) || 0;
      totalAmount += amt;
      if (r.payment?.method === 'Online') {
        onlineCount += 1;
        onlineAmount += amt;
      } else {
        cashCount += 1;
        cashAmount += amt;
      }
      const biz = bizMap[r.businessId];
      (biz?.fields || []).forEach((f) => {
        if (f.type === 'table') {
          const cols = Array.isArray(f.columns) ? f.columns : [];
          const tRows = Array.isArray(r.repeatingTables?.[f.fieldName])
            ? r.repeatingTables[f.fieldName]
            : [];
          totalRepeatingEntries += tRows.filter((row) => isRowPopulatedServer(row, cols)).length;
        }
      });
    });

    const scopeBusinesses = selectedBiz ? [selectedBiz] : userBusinesses;
    const formSummaries = [];
    const fieldSummaries = [];

    scopeBusinesses.forEach((biz) => {
      const bizRecs = filteredRecords.filter((r) => r.businessId === biz.id);
      let bizAmount = 0;
      let bizCash = 0;
      let bizOnline = 0;
      let bizRepeatingRows = 0;
      const repeatingTableFields = (biz.fields || []).filter((f) => f.type === 'table');

      bizRecs.forEach((r) => {
        const amt = Number(r.payment?.amount) || 0;
        bizAmount += amt;
        if (r.payment?.method === 'Online') bizOnline += amt;
        else bizCash += amt;
        repeatingTableFields.forEach((tf) => {
          const cols = Array.isArray(tf.columns) ? tf.columns : [];
          const tRows = Array.isArray(r.repeatingTables?.[tf.fieldName])
            ? r.repeatingTables[tf.fieldName]
            : [];
          bizRepeatingRows += tRows.filter((row) => isRowPopulatedServer(row, cols)).length;
        });
      });

      formSummaries.push({
        businessId: biz.id,
        name: biz.name,
        category: biz.category || '',
        archived: Boolean(biz.archived),
        fieldCount: (biz.fields || []).length,
        repeatingTableCount: repeatingTableFields.length,
        recordCount: bizRecs.length,
        repeatingRowCount: bizRepeatingRows,
        totalAmount: Number(bizAmount.toFixed(2)),
        cashAmount: Number(bizCash.toFixed(2)),
        onlineAmount: Number(bizOnline.toFixed(2)),
      });

      if (bizRecs.length === 0) return;

      (biz.fields || []).forEach((field) => {
        if (field.type === 'table') return;
        const label = selectedBiz ? field.label : `${biz.name} · ${field.label}`;
        if (field.type === 'number') {
          let sum = 0;
          let count = 0;
          bizRecs.forEach((r) => {
            const raw = r.answers?.[field.fieldName];
            if (raw !== '' && raw !== undefined && raw !== null) {
              const num = Number(raw);
              if (!Number.isNaN(num)) {
                sum += num;
                count += 1;
              }
            }
          });
          if (count > 0) {
            fieldSummaries.push({
              key: `${biz.id}-${field.fieldName}`,
              businessName: biz.name,
              label,
              type: 'number',
              summaryText: `Total: ${Number(sum.toFixed(2)).toLocaleString()} · Avg: ${(sum / count).toFixed(1)} (${count} ${count === 1 ? 'entry' : 'entries'})`,
            });
          }
        } else if (field.type === 'boolean') {
          let yes = 0;
          let no = 0;
          bizRecs.forEach((r) => {
            if (r.answers?.[field.fieldName] === true) yes += 1;
            else if (r.answers?.[field.fieldName] === false) no += 1;
          });
          if (yes + no > 0) {
            fieldSummaries.push({
              key: `${biz.id}-${field.fieldName}`,
              businessName: biz.name,
              label,
              type: 'boolean',
              summaryText: `Yes: ${yes} · No: ${no}`,
            });
          }
        } else if (field.type === 'select') {
          const counts = {};
          bizRecs.forEach((r) => {
            const val = r.answers?.[field.fieldName];
            if (val) counts[val] = (counts[val] || 0) + 1;
          });
          const parts = Object.entries(counts).map(([k, v]) => `${k}: ${v}`);
          if (parts.length > 0) {
            fieldSummaries.push({
              key: `${biz.id}-${field.fieldName}`,
              businessName: biz.name,
              label,
              type: 'select',
              summaryText: parts.join(' · '),
            });
          }
        }
      });
    });

    const totalRecords = filteredRecords.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;

    const pagedRecords = filteredRecords.slice(startIdx, startIdx + pageSize).map((r) => {
      const biz = bizMap[r.businessId];
      const details = [];
      (biz?.fields || []).forEach((f) => {
        if (f.type === 'table') {
          const cols = Array.isArray(f.columns) ? f.columns : [];
          const rows = Array.isArray(r.repeatingTables?.[f.fieldName])
            ? r.repeatingTables[f.fieldName].filter((row) => isRowPopulatedServer(row, cols))
            : [];
          if (rows.length > 0) {
            details.push({
              label: f.label,
              value: `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
              isTable: true,
            });
          }
        } else {
          const val = r.answers?.[f.fieldName];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            details.push({
              label: f.label,
              value: f.type === 'boolean' ? (val ? 'Yes' : 'No') : String(val),
              isTable: false,
            });
          }
        }
      });

      return {
        id: r.id,
        businessId: r.businessId,
        businessName: biz?.name || '—',
        displayTitle: getRecordTitleServer(r, biz),
        customerName: r.customerName || '',
        customerPhone: r.customerPhone || '',
        customerEmail: r.customerEmail || '',
        date: getRecordEffectiveDate(r),
        payment: {
          amount: Number(r.payment?.amount) || 0,
          method: r.payment?.method === 'Online' ? 'Online' : 'Cash',
          transactionId: r.payment?.transactionId || '',
          paidAt: r.payment?.paidAt || getRecordEffectiveDate(r),
        },
        details,
        answers: r.answers || {},
        repeatingTables: r.repeatingTables || {},
        createdAt: r.createdAt,
      };
    });

    return {
      status: 200,
      data: {
        filters: {
          businessId: rawBusinessId,
          startDate,
          endDate,
          paymentMethod,
          q: searchQuery,
        },
        summary: {
          totalRecords,
          totalPayments: cashCount + onlineCount,
          totalAmount: Number(totalAmount.toFixed(2)),
          cashCount,
          cashAmount: Number(cashAmount.toFixed(2)),
          onlineCount,
          onlineAmount: Number(onlineAmount.toFixed(2)),
          totalRepeatingEntries,
          matchingForms: formSummaries.filter((f) => f.recordCount > 0 || selectedBizId !== null).length,
        },
        formSummaries,
        fieldSummaries,
        records: pagedRecords,
        pagination: {
          page: safePage,
          pageSize,
          totalRecords,
          totalPages,
        },
      },
    };
  }

  return null;
}
