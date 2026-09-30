import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { PageHeader } from '../components/PageHeader';
import { toast } from 'react-toastify';
import { Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { StudentAPI } from '../api/student.api';
import { CollegeAPI } from '../api/college.api';
import { useNavigate } from 'react-router-dom';

const parseDate = (dateVal: any) => {
  if (!dateVal) return undefined;
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  
  if (typeof dateVal === 'string') {
    const parts = dateVal.split(/[-/]/);
    if (parts.length === 3) {
      const d2 = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      if (!isNaN(d2.getTime())) return d2;
    }
  } else if (typeof dateVal === 'number') {
    const d3 = new Date((dateVal - 25569) * 86400 * 1000);
    if (!isNaN(d3.getTime())) return d3;
  }
  return undefined;
};

const StudentImport = ({ onClose }: { onClose?: () => void }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  const [viewStudent, setViewStudent] = useState<any | null>(null);

  useEffect(() => {
    CollegeAPI.findAll().then(res => setColleges(res.data)).catch(console.error);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Clean keys
        const cleanedData = data.map((row: any) => {
          const newRow: any = {};
          Object.keys(row).forEach(k => {
            newRow[k.trim()] = row[k];
          });
          return newRow;
        });

        setPreviewData(cleanedData);
      } catch (error) {
        toast.error("Failed to read the Excel file.");
      }
    };
    reader.readAsBinaryString(uploadedFile);
    // Reset file input so same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleImport = async (dataToImport: any[]) => {
    if (dataToImport.length === 0) {
      toast.error('No data to import. Please upload an Excel file first.');
      return;
    }
    setIsImporting(true);
    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < dataToImport.length; i++) {
      const row = dataToImport[i];
      try {
        // Find matching college
        const collegeName = (row['EDUCATIONAL INSTITUTION'] || row['EDUCATIONAL INS'] || row['COLLEGE'] || row['INSTITUTION'])?.toString().trim();
        let matchedCollege = colleges.find(c => 
          c.name.toLowerCase() === collegeName?.toLowerCase() || 
          c.shortName?.toLowerCase() === collegeName?.toLowerCase()
        );

        if (collegeName && !matchedCollege) {
          try {
            matchedCollege = await CollegeAPI.create({ 
              name: collegeName, 
              shortName: collegeName.substring(0, 10).toUpperCase() 
            });
            colleges.push(matchedCollege);
            setColleges([...colleges]);
          } catch (e) {
            console.error('Failed to auto-create college:', e);
          }
        }

        // Prepare student DTO
        const studentData = {
          regNo: row['REGIS NO']?.toString(),
          name: row['NAME'] || row['MANUAL REGSI NAME'] || 'Unknown',
          mobileNo: row['MOBILE NO']?.toString(),
          dob: parseDate(row['DOB'])?.toISOString(),
          collegeId: matchedCollege?.id, // Send the UUID instead of string
          educationalQua: row['COURSE']?.toString(),
          courseDuration: row['COURSE DURATION']?.toString(),
          emailId: row['E-MAIL ID']?.toString() || row['EMAIL ID']?.toString() || row['EMAIL']?.toString(),
          aadharNo: row['ADHAAR NUM']?.toString() || row['AADHAR NO']?.toString() || row['AADHAR NUMBER']?.toString() || row['AADHAAR']?.toString() || row['AADHAAR NO']?.toString(),
          bloodGroup: row['BLOOD GROUP']?.toString() || row['BLOOD GRP']?.toString(),
          fatherName: row['FATHER NAME']?.toString() || row["FATHER'S NAME"]?.toString(),
          fatherMobileNo: row['MOBILE NO_1']?.toString() || row['FATHER MOBILE']?.toString() || row['FATHER PHONE']?.toString(),
          motherName: row['MOTHER NAME']?.toString() || row["MOTHER'S NAME"]?.toString(),
          motherMobileNo: row['MOBILE NO_2']?.toString() || row['MOTHER MOBILE']?.toString() || row['MOTHER PHONE']?.toString(),
          guardianName: row['GURDIAN NAME']?.toString() || row['GUARDIAN NAME']?.toString(),
          guardianMobileNo: row['MOBILE NO_3']?.toString() || row['GUARDIAN MOBILE']?.toString() || row['GUARDIAN PHONE']?.toString(),
          maritalStatus: row['MARTIAL STS']?.toString() || row['MARITAL STATUS']?.toString(),
          roomNo: row['ROOM']?.toString() || row['BLOCK']?.toString() || row['ROOM NO']?.toString(),
          rent: row['RENT'] ? Number(row['RENT']) : undefined,
          advance: row['ADVANCE'] ? Number(row['ADVANCE']) : undefined,
          category: row['CATEGORY']?.toString(),
          foodType: row['FOOD TYPE']?.toString() || row['FOOD']?.toString(),
          vsrLedger1: row['VSR LEDGER-1']?.toString() || row['VSR SPOON 1']?.toString() || row['VSR LEDGER']?.toString(),
          dateOfJoining: parseDate(row['DOJ'])?.toISOString() || parseDate(row['DATE OF JOINING'])?.toISOString(),
          pursuingYear: row['PURSUING YEAR']?.toString() || row['PURSUING YEAR ']?.toString() || row['PASSING YEAR']?.toString()
        };

        // If name exists, create
        if (studentData.name) {
          await StudentAPI.create(studentData);
          successCount++;
        } else {
          throw new Error('Name missing');
        }

      } catch (err: any) {
        failedCount++;
        errors.push({ row: i + 2, name: row['NAME'], reason: err.message });
      }
    }

    setImportResults({ success: successCount, failed: failedCount, errors });
    setIsImporting(false);
    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} students!`);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '30px', width: '95vw', maxWidth: '1400px', height: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 25, right: 25, background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <XCircle size={20} />
        </button>
        <div style={{ paddingBottom: '40px' }}>
      {importResults && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '30px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: importResults.failed > 0 ? '#e11d48' : '#16a34a', fontSize: '20px' }}>
                {importResults.failed > 0 ? <AlertTriangle /> : <CheckCircle />} Import Results
              </h3>
              <button onClick={() => {
                if (importResults.success > 0) setPreviewData([]);
                setImportResults(null);
              }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', fontSize: '15px', fontWeight: 600, padding: '15px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px' }}>
              <span style={{ color: '#334155' }}>Total Records: {importResults.success + importResults.failed}</span>
              <span style={{ color: '#16a34a' }}>✓ {importResults.success} Imported</span>
              {importResults.failed > 0 && <span style={{ color: '#e11d48' }}>✗ {importResults.failed} Failed</span>}
            </div>

            {importResults.errors.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>Failed Records:</h4>
                <div style={{ background: '#fff1f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecdd3', maxHeight: '300px', overflowY: 'auto' }}>
                  {importResults.errors.map((e, idx) => (
                    <div key={idx} style={{ fontSize: '13px', color: '#be123c', marginBottom: '8px', paddingBottom: '8px', borderBottom: idx < importResults.errors.length - 1 ? '1px solid #fda4af' : 'none' }}>
                      <strong>Row {e.row} ({e.name || 'Unknown'}):</strong> {e.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => {
                if (importResults.success > 0) setPreviewData([]);
                setImportResults(null);
              }} style={{ padding: '10px 20px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Close
              </button>
              <button onClick={() => {
                if (onClose) onClose();
                else navigate('/hostellers');
              }} style={{ padding: '10px 20px', background: 'var(--sidebar-active)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Go to Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {!importResults && (
        <div className="content-card" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
          {/* Header Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Student Import Details</h1>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ background: '#198754', color: 'white', border: 'none', padding: '9px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Upload Excel
                <input id="excel-upload-input" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Filter Section */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Search Student</label>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  style={{ width: '180px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', fontSize: '14px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Room Filter</label>
                <select style={{ width: '160px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', color: '#334155', fontSize: '14px' }}>
                  <option>All Rooms</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>College Filter</label>
                <select style={{ width: '160px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', color: '#334155', fontSize: '14px' }}>
                  <option>All Colleges</option>
                  {colleges.map(c => <option key={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button 
                onClick={() => {
                  if (previewData.length === 0) {
                    document.getElementById('excel-upload-input')?.click();
                  } else {
                    handleImport(previewData);
                  }
                }} 
                disabled={isImporting} 
                style={{ background: isImporting ? '#94a3b8' : (previewData.length === 0 ? '#198754' : '#0d6efd'), color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: isImporting ? 'not-allowed' : 'pointer' }}
              >
                {isImporting ? 'Importing...' : (previewData.length === 0 ? 'Upload Excel File' : 'Save to Database')}
              </button>
              <button onClick={() => setPreviewData([])} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>

          {/* Table Section */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                Show <select style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', margin: '0 5px' }}><option>10</option><option>25</option><option>50</option></select> entries
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>Search:</span>
                <input 
                  type="text" 
                  style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', width: '200px' }} 
                />
              </div>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>SNO</th>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>STUDENT ID</th>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>NAME</th>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>CONTACT NO</th>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>STATUS</th>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>DATE</th>
                  <th style={{ padding: '12px 15px', fontSize: '12px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {previewData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                      No data to preview. Please upload an Excel file.
                    </td>
                  </tr>
                ) : (
                  previewData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#0d6efd' }}>{idx + 1}</td>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#475569' }}>{row['REGIS NO'] || '-'}</td>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>{row['NAME'] || row['MANUAL REGSI NAME']}</td>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#475569' }}>{row['MOBILE NO']}</td>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#64748b' }}>Pending Import</td>
                      <td style={{ padding: '15px', fontSize: '14px', color: '#64748b' }}>
                        {parseDate(row['DOB'] || row['DOJ'])?.toLocaleDateString('en-GB') || '-'}
                      </td>
                      <td style={{ padding: '15px', fontSize: '13px', fontWeight: 500 }}>
                        <span style={{ color: '#0d6efd', cursor: 'pointer', marginRight: '10px' }}>Edit</span>
                        <span onClick={() => setViewStudent(row)} style={{ color: '#198754', cursor: 'pointer', marginRight: '10px' }}>View</span>
                        <span style={{ color: '#dc3545', cursor: 'pointer' }}>Delete</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {viewStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '30px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>Student Details (Preview)</h3>
              <button onClick={() => setViewStudent(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div><strong style={{ color: '#64748b' }}>Name:</strong> {viewStudent['NAME'] || viewStudent['MANUAL REGSI NAME'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Reg No:</strong> {viewStudent['REGIS NO'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Mobile:</strong> {viewStudent['MOBILE NO'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>DOB:</strong> {parseDate(viewStudent['DOB'])?.toLocaleDateString('en-GB') || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Email:</strong> {viewStudent['E-MAIL ID'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>College:</strong> {viewStudent['EDUCATIONAL INS'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Room:</strong> {viewStudent['ROOM'] || viewStudent['BLOCK'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Aadhar:</strong> {viewStudent['ADHAAR NUM'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Blood Group:</strong> {viewStudent['BLOOD GROUP'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Father Name:</strong> {viewStudent['FATHER NAME'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Father Mobile:</strong> {viewStudent['MOBILE NO_1'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Mother Name:</strong> {viewStudent['MOTHER NAME'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Mother Mobile:</strong> {viewStudent['MOBILE NO_2'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Course:</strong> {viewStudent['COURSE'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Rent:</strong> {viewStudent['RENT'] || '-'}</div>
              <div><strong style={{ color: '#64748b' }}>Advance:</strong> {viewStudent['ADVANCE'] || '-'}</div>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setViewStudent(null)} style={{ padding: '10px 20px', background: 'var(--sidebar-active)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      </div>
    </div>
  );
};

export default StudentImport;
