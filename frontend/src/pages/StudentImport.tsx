import { useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { StudentAPI } from '../api/student.api';
import { CollegeAPI } from '../api/college.api';
import Swal from 'sweetalert2';

const parseDate = (dateVal: any) => {
  if (!dateVal) return undefined;
  
  if (typeof dateVal === 'string') {
    const parts = dateVal.split(/[-/]/);
    if (parts.length === 3) {
      // Prioritize DD/MM/YYYY
      const d2 = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      if (!isNaN(d2.getTime())) return d2;
    }
  } else if (typeof dateVal === 'number') {
    const d3 = new Date((dateVal - 25569) * 86400 * 1000);
    if (!isNaN(d3.getTime())) return d3;
  }

  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;

  return undefined;
};

const StudentImport = ({ file, onClose }: { file?: File, onClose?: () => void }) => {
  

  // We will fetch colleges inside handleImport to avoid stale closure issues

  useEffect(() => {
    if (file) {
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
              newRow[k.trim().toUpperCase()] = row[k];
            });
            return newRow;
          });

          
          Swal.fire({
            title: 'Confirm Import',
            text: `Do you want to add this data? Total records: ${cleanedData.length}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            cancelButtonColor: '#dc3545',
            confirmButtonText: 'Yes, import it!'
          }).then((result) => {
            if (result.isConfirmed) {
              handleImport(cleanedData);
            } else {
              if (onClose) onClose();
            }
          });
        } catch (error) {
          toast.error("Failed to read the Excel file.");
          if (onClose) onClose();
        }
      };
      reader.readAsBinaryString(file);
    }
  }, [file]);

  const handleImport = async (dataToImport: any[]) => {
    if (dataToImport.length === 0) {
      toast.error('No data to import.');
      if (onClose) onClose();
      return;
    }
    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];
    
    // Fetch fresh colleges to avoid stale state from closures
    let currentColleges: any[] = [];
    try {
      const res = await CollegeAPI.findAll({ limit: 1000 });
      currentColleges = res.data || [];
    } catch (e) {
      console.error("Failed to fetch colleges", e);
    }

    for (let i = 0; i < dataToImport.length; i++) {
      const row = dataToImport[i];
      try {
        // Find matching college
        const collegeName = (
          row['EDUCATIONAL INSTITUTION'] || 
          row['EDUCATIONAL INS.'] || 
          row['EDUCATIONAL INS'] || 
          row['COLLEGE'] || 
          row['INSTITUTION'] || 
          row['COLLEGE NAME'] || 
          row['COLLEGE / DEPT'] || 
          row['COLLEGE/DEPT'] || 
          row['UNIVERSITY']
        )?.toString().trim();
        let matchedCollege = currentColleges.find(c => 
          c.name.toLowerCase() === collegeName?.toLowerCase() || 
          c.shortName?.toLowerCase() === collegeName?.toLowerCase()
        );

        if (collegeName && !matchedCollege) {
          try {
            matchedCollege = await CollegeAPI.create({ 
              name: collegeName, 
              shortName: collegeName.substring(0, 10).toUpperCase() 
            });
            currentColleges.push(matchedCollege);
          } catch (e: any) {
            console.error('Failed to auto-create college:', e);
            // If it failed because it exists (maybe a race condition), let's try to fetch it
            try {
              const res = await CollegeAPI.findAll({ limit: 1000 });
              currentColleges = res.data || [];
              matchedCollege = currentColleges.find(c => 
                c.name.toLowerCase() === collegeName?.toLowerCase() || 
                c.shortName?.toLowerCase() === collegeName?.toLowerCase()
              );
            } catch (innerE) {
              console.error(innerE);
            }
          }
        }

        // Prepare student DTO
        const studentData = {
          regNo: row['REGIS NO']?.toString() || row['REG IS NO']?.toString(),
          name: row['NAME'] || row['MANUAL REGSI NAME'],
          gender: row['GENDER']?.toString() || 'Female',
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
          roomNo: (() => {
            const block = row['BLOCK'];
            const room = row['ROOM'] || row['ROOM NO'];
            const b = block ? block.toString().toUpperCase().replace(/BLOCK\s*/, '').trim() : '';
            let r = room ? room.toString().toUpperCase().replace(/ROOM\s*/, '').trim() : '';
            if (!b && !r) return undefined;
            if (b && r.startsWith(b)) return r.replace(/\s+/g, '');
            if (b && !r.startsWith(b)) return `${b}${r}`.replace(/\s+/g, '');
            return (r || b).replace(/\s+/g, '');
          })(),
          rent: row['RENT'] ? Number(row['RENT']) : undefined,
          advance: row['ADVANCE'] ? Number(row['ADVANCE']) : undefined,
          category: row['CATEGORY']?.toString(),
          foodType: row['FOOD TYPE']?.toString() || row['FOOD']?.toString(),
          vsrLedger1: row['VSR LEDGER-1']?.toString() || row['VSR SPOON 1']?.toString() || row['VSR LEDGER']?.toString(),
          dateOfJoining: parseDate(row['DOJ'])?.toISOString() || parseDate(row['DATE OF JOINING'])?.toISOString(),
          pursuingYear: row['PURSUING YEAR']?.toString() || row['PURSUING YEAR ']?.toString() || row['PASSING YEAR']?.toString(),
          isImport: true
        };

        // Validation
        if (!studentData.name || studentData.name.trim() === '') {
          throw new Error('Name is required. The NAME column is missing or empty.');
        }
        if (!studentData.mobileNo || studentData.mobileNo.trim() === '') {
          throw new Error('Mobile Number is required. The MOBILE NO column is missing or empty.');
        }

        // Create
        await StudentAPI.create(studentData);
        successCount++;

      } catch (err: any) {
        failedCount++;
        errors.push({ row: i + 2, name: row['NAME'] || 'Unknown', reason: err.message });
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} students!`);
    }

    let resultHtml = `
      <div style="text-align: left; font-size: 15px;">
        <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
          <div style="margin-bottom: 8px;"><strong>Total Records:</strong> ${dataToImport.length}</div>
          <div style="color: #16a34a; margin-bottom: 8px;"><strong>✓ Imported:</strong> ${successCount}</div>
          <div style="color: ${failedCount > 0 ? '#e11d48' : '#64748b'};"><strong>✗ Failed:</strong> ${failedCount}</div>
        </div>
    `;

    if (errors.length > 0) {
      resultHtml += `
        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #334155;">Failed Records:</h4>
        <div style="max-height: 250px; overflow-y: auto; background: #fff1f2; padding: 15px; border-radius: 8px; border: 1px solid #fecdd3;">
      `;
      errors.forEach((e, idx) => {
        resultHtml += `
          <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: ${idx < errors.length - 1 ? '1px solid #fda4af' : 'none'}; font-size: 13px; color: #be123c;">
            <strong>Row ${e.row} (${e.name}):</strong> ${e.reason}
          </div>
        `;
      });
      resultHtml += `</div>`;
    }
    
    resultHtml += `</div>`;

    Swal.fire({
      title: 'Import Results',
      html: resultHtml,
      icon: failedCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#0d6efd',
      width: '600px'
    }).then(() => {
      if (onClose) onClose();
    });
  };

  return <></>;
};

export default StudentImport;
