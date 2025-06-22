// Mock data for testing UI components
export const mockExtraction = {
  sessionId: 'mock-session-123',
  status: 'in_progress',
  totalFields: 8,
  completedFields: 3,
  fields: [
    {
      id: 'field-1',
      name: 'Check Number',
      value: '1234',
      confidence: 0.98,
      bounds: { x: 100, y: 100, width: 100, height: 30 },
      page: 1,
      status: 'approved'
    },
    {
      id: 'field-2',
      name: 'Date',
      value: '11/15/2023',
      confidence: 0.95,
      bounds: { x: 250, y: 100, width: 120, height: 30 },
      page: 1,
      status: 'approved'
    },
    {
      id: 'field-3',
      name: 'Amount',
      value: '$1,250.00',
      confidence: 0.89,
      bounds: { x: 400, y: 100, width: 100, height: 30 },
      page: 1,
      status: 'approved'
    },
    {
      id: 'field-4',
      name: 'Payee Name',
      value: 'John Doe',
      confidence: 0.75,
      bounds: { x: 100, y: 200, width: 200, height: 30 },
      page: 1,
      status: 'pending'
    },
    {
      id: 'field-5',
      name: 'Account Number',
      value: '****4567',
      confidence: 0.92,
      bounds: { x: 100, y: 250, width: 150, height: 30 },
      page: 1,
      status: 'pending'
    }
  ]
};

export const mockExcelData = [
  ['Check Number', 'Date', 'Amount', 'Payee Name', 'Account Number'],
  ['1234', '11/15/2023', '$1,250.00', 'John Doe', '****4567'],
  ['1235', '11/16/2023', '$500.00', 'Jane Smith', '****8901'],
  ['1236', '11/17/2023', '$750.00', 'ABC Company', '****2345']
];

export const mockPdfInfo = {
  fileName: 'Check-EFTInfo - 2023-11-15T055920.964.pdf',
  totalPages: 3,
  fileSize: '1.2 MB',
  uploadedAt: new Date().toISOString()
};