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
      let year = Number(parts[2]);
      if (year > 9999) {
        // user typo, e.g. 20077 -> 2007
        const yearStr = parts[2];
        year = Number(yearStr.substring(0, 4));
      }
      const d2 = new Date(year, Number(parts[1]) - 1, Number(parts[0]));
      if (!isNaN(d2.getTime())) return d2;
    }
  } else if (typeof dateVal === 'number') {
    const d3 = new Date((dateVal - 25569) * 86400 * 1000);
    if (!isNaN(d3.getTime())) return d3;
  }

  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    if (d.getFullYear() > 9999) {
       d.setFullYear(Number(d.getFullYear().toString().substring(0, 4)));
    }
    return d;
  }

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
            // __rowNum__ is a hidden non-enumerable property added by xlsx
            if (row.__rowNum__ !== undefined) {
              newRow['__ROWNUM__'] = row.__rowNum__;
            }
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
              Swal.fire({
                title: 'Uploading...',
                html: 'Please wait while we import the records.',
                allowOutsideClick: false,
                didOpen: () => {
                  Swal.showLoading();
                }
              });
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
      
      // Skip completely empty rows or rows that are just subheadings (less than 3 filled columns)
      if (!row || Object.keys(row).length === 0) continue;
      const filledValues = Object.values(row).filter(v => v && v.toString().trim() !== '');
      if (filledValues.length < 3) {
        continue; // This is a subheading like "NEW STUDENT(2026)" or "SSM LEDER-1", skip silently
      }
      
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
          isImport: true,
          // Ignore regNo from Excel, let the backend auto-generate it securely
          // regNo: row['REGIS NO']?.toString() || row['REG IS NO']?.toString(),
          name: row['NAME']?.toString() || row['STUDENT NAME']?.toString() || row['FULL NAME']?.toString() || row['HOSTELER NAME']?.toString(),
          manualRegsiName: row['MANUAL REGSI NAME']?.toString(),
          gender: row['GENDER']?.toString() || 'Female',
          mobileNo: row['MOBILE NO']?.toString() || row['MOBILE']?.toString() || row['PHONE']?.toString() || row['CONTACT NO']?.toString() || row['CONTACT']?.toString() || row['PHONE NO']?.toString(),
          dob: parseDate(row['DOB'])?.toISOString(),
          collegeId: matchedCollege?.id, // Send the UUID instead of string
          educationalQua: row['COURSE']?.toString(),
          courseDuration: row['COURSE DURATION']?.toString(),
          emailId: row['E-MAIL ID']?.toString() || row['EMAIL ID']?.toString() || row['EMAIL']?.toString(),
          aadharNo: row['ADHAAR NUM']?.toString() || row['AADHAR NO']?.toString() || row['AADHAR NUMBER']?.toString() || row['AADHAAR']?.toString() || row['AADHAAR NO']?.toString(),
          bloodGroup: row['BLOOD GROUP']?.toString() || row['BLOOD GRP']?.toString(),
          fatherName: row['FATHER NAME']?.toString() || row["FATHER'S NAME"]?.toString(),
          fatherMobileNo: row['MOBILE NO_1']?.toString() || row['FATHER MOBILE']?.toString() || row['FATHER PHONE']?.toString() || row["FATHER'S MOBILE"]?.toString(),
          motherName: row['MOTHER NAME']?.toString() || row["MOTHER'S NAME"]?.toString(),
          motherMobileNo: row['MOBILE NO_2']?.toString() || row['MOTHER MOBILE']?.toString() || row['MOTHER PHONE']?.toString() || row["MOTHER'S MOBILE"]?.toString(),
          guardianName: row['GURDIAN NAME']?.toString() || row['GUARDIAN NAME']?.toString(),
          guardianMobileNo: row['MOBILE NO_3']?.toString() || row['GUARDIAN MOBILE']?.toString() || row['GUARDIAN PHONE']?.toString() || row["GUARDIAN'S MOBILE"]?.toString(),
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
          rent: row['RENT'] && Number(row['RENT']) > 2000 ? Number(row['RENT']) - 2000 : (row['RENT'] ? Number(row['RENT']) : undefined),
          messFee: row['RENT'] && Number(row['RENT']) > 2000 ? 2000 : 0,
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
          // Find the first non-empty string in the row to give a hint
          const availableData = Object.entries(row)
            .map(([k, v]) => `${k}="${v}"`)
            .join(', ');
          throw new Error(`Name is required. The NAME column is missing. (Found data in this row: ${availableData})`);
        }
        if (!studentData.mobileNo || studentData.mobileNo.trim() === '') {
          throw new Error('Mobile Number is required. The MOBILE NO column is missing or empty.');
        }

        // Create
        await StudentAPI.create(studentData);
        successCount++;

      } catch (err: any) {
        failedCount++;
        // Try to guess the name for the error display if it's missing from the standard column
        let displayHint = row['NAME'] || row['STUDENT NAME'] || row['FULL NAME'];
        if (!displayHint) {
          // just grab the second or third value in the row object as a hint
          const vals = Object.values(row).filter(v => v && typeof v === 'string' && v.length > 2 && isNaN(Number(v)) && !v.includes('__ROWNUM__'));
          if (vals.length > 0) displayHint = vals[0];
        }
        
        // Calculate exact Excel row number using __ROWNUM__ (0-indexed) if available
        const exactRow = row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2);

        errors.push({ 
          row: exactRow, 
          name: displayHint || 'Unknown', 
          reason: err.message 
        });
      }
    }

    if (failedCount === 0) {
      // 100% success
      toast.success(`${successCount} records imported successfully!`);
      if (onClose) onClose();
      Swal.close();
      return;
    }

    // If there are failures, show the modal
    let resultHtml = `
      <div style="text-align: left; font-size: 15px;">
        <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
          <div style="margin-bottom: 8px;"><strong>Total Records:</strong> ${dataToImport.length}</div>
          <div style="color: #16a34a; margin-bottom: 8px;"><strong>✓ Imported:</strong> ${successCount}</div>
          <div style="color: #e11d48;"><strong>✗ Failed:</strong> ${failedCount}</div>
        </div>
    `;

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
    resultHtml += `</div></div>`;

    Swal.fire({
      title: 'Import Results',
      html: resultHtml,
      icon: successCount > 0 ? 'warning' : 'error',
      confirmButtonText: 'OK',
      showCancelButton: true,
      cancelButtonText: 'Export Failed Records',
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#e11d48',
      width: '600px'
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        // Export to Excel
        const ws = XLSX.utils.json_to_sheet(errors.map(e => ({ Row: e.row, Name: e.name, ErrorReason: e.reason })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Failed Records");
        XLSX.writeFile(wb, "Failed_Import_Records.xlsx");
      }
      if (onClose) onClose();
    });
  };

  return <></>;
};

export default StudentImport;
