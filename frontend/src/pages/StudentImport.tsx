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
      let day = Number(parts[0]);
      let month = Number(parts[1]);
      // Handle M/D/YYYY (e.g. 2/27/2022) where 2nd part > 12
      if (month > 12 && day >= 1 && day <= 12) {
        const tmp = day;
        day = month;
        month = tmp;
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d2 = new Date(year, month - 1, day);
        if (!isNaN(d2.getTime())) return d2;
      }
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

const cleanString = (val: any): string | undefined => {
  if (val === undefined || val === null) return undefined;
  const s = val.toString().replace(/[\u00A0\u200B]/g, ' ').trim();
  if (!s) return undefined;
  const upper = s.toUpperCase().replace(/\s+/g, '');
  if (['NA', 'N/A', 'N/A.', 'NIL', 'NIL.', 'NONE', '-', '--', '0', '0000000000', '000000000000', 'NULL', 'UNDEFINED', 'NO', 'NOEMAIL', 'NOMOBILE'].includes(upper)) {
    return undefined;
  }
  return s;
};

const normKey = (h: string) => h.trim().toUpperCase().replace(/[\u00A0\u200B]/g, '').replace(/[^A-Z0-9]/g, '');

const extractExcelValue = (row: any, patterns: string[]): string | undefined => {
  if (!row) return undefined;
  const normPatterns = patterns.map(p => normKey(p));

  // 1. Exact normalized key match (Highest priority)
  for (const [key, val] of Object.entries(row)) {
    if (key === '__ROWNUM__') continue;
    const nk = normKey(key);
    if (normPatterns.includes(nk)) {
      const c = cleanString(val);
      if (c !== undefined) return c;
    }
  }

  // 2. Strict partial key match without cross-field contamination
  const EXPLICIT_NAME_KEYS = [
    'NAME', 'STUDENTNAME', 'FULLNAME', 'HOSTELERNAME', 'CANDIDATENAME', 
    'FATHERNAME', 'MOTHERNAME', 'GUARDIANNAME', 'STUDENT', 'NAMEOFSTUDENT', 
    'NAMEOFTHESTUDENT', 'STUDENTSNAME', 'CANDIDATE', 'HOSTELER'
  ];

  for (const [key, val] of Object.entries(row)) {
    if (key === '__ROWNUM__') continue;
    const nk = normKey(key);

    const isLookingForCollege = normPatterns.some(p => p.includes('COLLEGE') || p.includes('EDUCATIONAL') || p.includes('INSTITUTION'));
    const isLookingForRoom = normPatterns.some(p => p.includes('ROOM') || p.includes('BLOCK'));

    // Skip matching explicit Name column when searching for College or Room
    if ((isLookingForCollege || isLookingForRoom) && EXPLICIT_NAME_KEYS.some(k => nk === k || nk.includes(k))) {
      continue;
    }

    for (const np of normPatterns) {
      if (nk === np || (nk.length > np.length && (nk.startsWith(np) || nk.endsWith(np)))) {
        const c = cleanString(val);
        if (c !== undefined) return c;
      }
    }
  }

  return undefined;
};

const StudentImport = ({ file, onClose }: { file?: File, onClose?: () => void }) => {

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

          const cleanedData = data.map((row: any) => {
            const newRow: any = {};
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
            text: `Do you want to import ${cleanedData.length} student records from Excel?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            cancelButtonColor: '#dc3545',
            confirmButtonText: 'Yes, import now!'
          }).then((result) => {
            if (result.isConfirmed) {
              Swal.fire({
                title: 'Uploading Records...',
                html: 'Processing student data from Excel, please wait...',
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
    let skippedCount = 0;
    const errors: any[] = [];

    let currentColleges: any[] = [];
    try {
      const res = await CollegeAPI.findAll({ limit: 1000 });
      currentColleges = res.data || [];
    } catch (e) {
      console.error("Failed to fetch colleges", e);
    }

    for (let i = 0; i < dataToImport.length; i++) {
      const row = dataToImport[i];

      if (!row || Object.keys(row).length === 0) {
        skippedCount++;
        errors.push({
          row: i + 2,
          name: 'Blank Row',
          reason: 'Empty row in Excel file skipped',
          originalRow: {}
        });
        continue;
      }

      const nonNumEntries = Object.entries(row).filter(([k]) => k !== '__ROWNUM__');
      const filledValues = nonNumEntries
        .map(([, v]) => cleanString(v))
        .filter(Boolean);

      if (filledValues.length === 0) {
        skippedCount++;
        errors.push({
          row: row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2),
          name: 'Blank Formatting Row',
          reason: 'Empty formatting row skipped',
          originalRow: row
        });
        continue;
      }

      // Skip subheadings / single-cell title rows cleanly
      if (filledValues.length === 1 && !/SEASIND/i.test(filledValues[0]!)) {
        skippedCount++;
        errors.push({
          row: row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2),
          name: filledValues[0] || 'Subheading',
          reason: 'Section subheading / header title skipped',
          originalRow: row
        });
        continue;
      }

      try {
        const nameVal = extractExcelValue(row, ['NAME', 'STUDENT NAME', 'FULL NAME', 'HOSTELER NAME', 'CANDIDATE NAME', 'STUDENT', 'NAME OF STUDENT']);
        const mobileVal = extractExcelValue(row, ['MOBILE NO', 'MOBILE', 'MOB', 'MOB NO', 'MOB.NO', 'CELL', 'CELL NO', 'CONTACT NO', 'CONTACT', 'CONTACT NUMBER', 'MOBILE NUMBER', 'PHONE', 'PHONE NO', 'PH NO', 'STUDENT MOBILE', 'STUDENT PHONE']);
        const dobVal = extractExcelValue(row, ['DOB', 'DATE OF BIRTH', 'BIRTH DATE']);
        const courseVal = extractExcelValue(row, ['COURSE', 'EDUCATIONAL QUA', 'QUALIFICATION', 'DEGREE', 'PROGRAM']);
        const courseDurVal = extractExcelValue(row, ['COURSE DURATION', 'DURATION', 'COURSE PERIOD']);
        const emailVal = extractExcelValue(row, ['E-MAIL ID', 'EMAIL ID', 'EMAIL', 'EMAIL ADDRESS', 'STUDENT EMAIL']);
        const aadharVal = extractExcelValue(row, ['ADHAAR NUM', 'AADHAR NO', 'AADHAR NUMBER', 'AADHAAR', 'AADHAAR NO', 'ADHAR NO']);
        const bloodVal = extractExcelValue(row, ['BLOOD GROUP', 'BLOOD GRP', 'BLOOD']);
        const fatherVal = extractExcelValue(row, ['FATHER NAME', "FATHER'S NAME", 'FATHER']);
        const fatherMobVal = extractExcelValue(row, ['MOBILE NO_1', 'FATHER MOBILE', 'FATHER PHONE', "FATHER'S MOBILE", 'FATHER CONTACT']);
        const motherVal = extractExcelValue(row, ['MOTHER NAME', "MOTHER'S NAME", 'MOTHER']);
        const motherMobVal = extractExcelValue(row, ['MOBILE NO_2', 'MOTHER MOBILE', 'MOTHER PHONE', "MOTHER'S MOBILE", 'MOTHER CONTACT']);
        const guardianVal = extractExcelValue(row, ['GURDIAN NAME', 'GUARDIAN NAME', "GUARDIAN'S NAME", 'GUARDIAN']);
        const guardianMobVal = extractExcelValue(row, ['MOBILE NO_3', 'GUARDIAN MOBILE', 'GUARDIAN PHONE', "GUARDIAN'S MOBILE", 'GUARDIAN CONTACT']);
        const maritalVal = extractExcelValue(row, ['MARTIAL STS', 'MARITAL STATUS', 'MARITAL']);
        const rentVal = extractExcelValue(row, ['RENT', 'MONTHLY RENT', 'ROOM RENT', 'HOSTEL RENT']);
        const advVal = extractExcelValue(row, ['ADVANCE', 'DEPOSIT', 'SECURITY DEPOSIT']);
        const foodVal = extractExcelValue(row, ['FOOD TYPE', 'FOOD', 'DIET', 'MEAL TYPE']);
        const vsrVal = extractExcelValue(row, ['VSR LEDGER-1', 'VSR SPOON 1', 'VSR LEDGER', 'LEDGER-1', 'LEDGER']);
        const dojVal = extractExcelValue(row, ['DOJ', 'DATE OF JOINING', 'JOINING DATE', 'ADMISSION DATE']);
        const yearVal = extractExcelValue(row, ['PURSUING YEAR', 'PURSUING YEAR ', 'PASSING YEAR', 'YEAR', 'CURRENT YEAR']);

        // Strict College Extraction & Validation
        const collegeName = extractExcelValue(row, [
          'EDUCATIONAL INS', 'EDUCATIONAL INS.', 'EDUCATIONAL INSTITUTION', 'EDUCATIONAL INST',
          'COLLEGE', 'COLLEGE NAME', 'INSTITUTION', 'UNIVERSITY', 'CLG', 'COLLEGE/DEPT', 'SCHOOL'
        ]);

        let matchedCollege: any = undefined;

        const findMatchingCollege = (cleanCol: string) => {
          if (!cleanCol || cleanCol.length < 2) return undefined;
          const target = cleanCol.toLowerCase().replace(/[^a-z0-9]/g, '');

          // 1. Exact or normalized name/shortName match
          for (const c of currentColleges) {
            const nameNorm = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const shortNorm = (c.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (target === nameNorm || (shortNorm && target === shortNorm)) return c;
          }

          // 2. Bidirectional contains match (e.g. "SSM" <-> "SSM College")
          for (const c of currentColleges) {
            const nameNorm = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const shortNorm = (c.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (
              (nameNorm && nameNorm.length >= 2 && (target.includes(nameNorm) || nameNorm.includes(target))) ||
              (shortNorm && shortNorm.length >= 2 && (target.includes(shortNorm) || shortNorm.includes(target)))
            ) {
              return c;
            }
          }

          // 3. Known acronym / pattern rules
          if (/^SSM/i.test(cleanCol)) return currentColleges.find(c => /^SSM/i.test(c.name));
          if (/^JKKN/i.test(cleanCol)) return currentColleges.find(c => /^JKKN/i.test(c.name));
          if (/^JKKM/i.test(cleanCol)) return currentColleges.find(c => /^JKKM/i.test(c.name));
          if (/^EXCEL/i.test(cleanCol)) return currentColleges.find(c => /^EXCEL/i.test(c.name));
          if (/^SHANMUGA/i.test(cleanCol)) return currentColleges.find(c => /SHANMUGA/i.test(c.name));
          if (/^GOVT/i.test(cleanCol)) return currentColleges.find(c => /GOVT/i.test(c.name));

          return undefined;
        };

        if (collegeName) {
          const cleanCol = collegeName.trim();

          // 1. Match against existing colleges in database first
          matchedCollege = findMatchingCollege(cleanCol);

          // 2. If not matched, auto-create ONLY if it is a genuine new college name (not a person name)
          if (!matchedCollege) {
            const hasPersonInitial = /(?:\s+|\.)[A-Z]\.?$/i.test(cleanCol);
            const isMatchingPersonName = (
              (nameVal && cleanCol.toLowerCase() === nameVal.toLowerCase()) ||
              (fatherVal && cleanCol.toLowerCase() === fatherVal.toLowerCase()) ||
              (motherVal && cleanCol.toLowerCase() === motherVal.toLowerCase()) ||
              (guardianVal && cleanCol.toLowerCase() === guardianVal.toLowerCase())
            );

            if (!hasPersonInitial && !isMatchingPersonName && cleanCol.length >= 2) {
              try {
                matchedCollege = await CollegeAPI.create({
                  name: cleanCol,
                  shortName: cleanCol.substring(0, 10).toUpperCase()
                });
                currentColleges.push(matchedCollege);
              } catch (e: any) {
                console.error('Failed to auto-create college:', e);
              }
            }
          }
        }

        // Tier 1: Scan ALL cell values for explicit registration patterns like SEASIND26312 (HIGHEST PRIORITY!)
        let extractedManualReg: string | undefined = undefined;
        for (const [, val] of nonNumEntries) {
          if (val !== undefined && val !== null) {
            const s = val.toString().replace(/[\u00A0\u200B]/g, ' ').trim();
            if (/SEASIND[\s\-_.]*\d+/i.test(s)) {
              const m = s.match(/SEASIND[\s\-_.]*\d+/i);
              if (m) {
                extractedManualReg = m[0].replace(/[\s\-_.]/g, '').toUpperCase();
                break;
              }
            }
          }
        }

        // Tier 2: Explicit manual reg headers
        if (!extractedManualReg) {
          const manualRegExplicit = [
            'MANUAL REGSI NAME', 'MANUAL REG NAME', 'MANUAL REG NO', 'MANUAL REG', 'MANUAL REG. NO.',
            'MANUAL REGISTER NAME', 'MANUAL REGISTER NO', 'MANUAL REGISTRATION NO', 'MANUAL REGS',
            'REGSI NAME', 'REGINAME', 'REGSINAME', 'REG. NAME', 'REG NAME'
          ];
          extractedManualReg = extractExcelValue(row, manualRegExplicit);
        }

        // Tier 3: Standard reg no headers
        if (!extractedManualReg) {
          const regNoPatterns = [
            'REGISTRATION NO', 'REGISTRATION NUMBER', 'REGISTER NO', 'REGISTER NUMBER',
            'REG NO', 'REG. NO.', 'REG.NO.', 'REG.NO', 'REGIS NO', 'REG IS NO', 'REGIST NO',
            'REGS NO', 'REGS. NO', 'STUDENT ID', 'ADMISSION NO', 'ADM NO', 'ENROLLMENT NO', 'ROLL NO', 'ID NO'
          ];
          extractedManualReg = extractExcelValue(row, regNoPatterns);
        }

        const blockVal = extractExcelValue(row, ['BLOCK', 'BLOCK NAME']);
        const roomVal = extractExcelValue(row, ['ROOM', 'ROOM NO', 'ROOM NUMBER']);

        let computedRoomNo: string | undefined = undefined;
        const b = blockVal ? blockVal.toUpperCase().replace(/BLOCK\s*/, '').trim() : '';
        let r = roomVal ? roomVal.toUpperCase().replace(/ROOM\s*/, '').trim() : '';
        if (b || r) {
          if (b && r.startsWith(b)) computedRoomNo = r.replace(/\s+/g, '');
          else if (b && !r.startsWith(b)) computedRoomNo = `${b}${r}`.replace(/\s+/g, '');
          else computedRoomNo = (r || b).replace(/\s+/g, '');
        }

        // Strict Room Validation
        if (computedRoomNo) {
          const cleanRoom = computedRoomNo.trim().replace(/[`']/g, '');
          const isPersonNameRoom = (
            cleanRoom.length > 10 ||
            /\.[A-Za-z]$/.test(cleanRoom) ||
            (/^[A-Za-z]{3,}$/.test(cleanRoom) && !/^(BLOCK|ROOM|FLAT|FLOOR|HALL|DORM|SUITE)/i.test(cleanRoom)) ||
            (/[A-Z]\s*$/.test(cleanRoom) && cleanRoom.length > 4) ||
            (nameVal && cleanRoom.toLowerCase().includes(nameVal.toLowerCase().replace(/[\s.]+/g, ''))) ||
            (fatherVal && cleanRoom.toLowerCase().includes(fatherVal.toLowerCase().replace(/[\s.]+/g, ''))) ||
            (guardianVal && cleanRoom.toLowerCase().includes(guardianVal.toLowerCase().replace(/[\s.]+/g, '')))
          );

          if (isPersonNameRoom) {
            computedRoomNo = undefined;
          } else {
            computedRoomNo = cleanRoom;
          }
        }

        const studentData = {
          isImport: true,
          name: nameVal,
          manualRegsiName: extractedManualReg,
          gender: extractExcelValue(row, ['GENDER', 'SEX']) || 'Female',
          mobileNo: mobileVal,
          dob: parseDate(dobVal)?.toISOString(),
          collegeId: matchedCollege?.id,
          educationalQua: courseVal,
          courseDuration: courseDurVal,
          emailId: emailVal,
          aadharNo: aadharVal,
          bloodGroup: bloodVal,
          fatherName: fatherVal,
          fatherMobileNo: fatherMobVal,
          motherName: motherVal,
          motherMobileNo: motherMobVal,
          guardianName: guardianVal,
          guardianMobileNo: guardianMobVal,
          maritalStatus: maritalVal,
          roomNo: computedRoomNo,
          rent: rentVal && Number(rentVal) > 2000 ? Number(rentVal) - 2000 : (rentVal ? Number(rentVal) : undefined),
          messFee: rentVal && Number(rentVal) > 2000 ? 2000 : 0,
          advance: advVal ? Number(advVal) : undefined,
          category: extractExcelValue(row, ['CATEGORY', 'COMMUNITY']),
          foodType: foodVal,
          vsrLedger1: vsrVal,
          dateOfJoining: parseDate(dojVal)?.toISOString(),
          pursuingYear: yearVal
        };

        // Check if row is a header title row (e.g. "STUDENT NAME", "SL NO")
        const nameUpper = (studentData.name || '').toUpperCase().trim();
        const exactHeaderTitles = [
          'SL NO', 'SL.NO', 'S.NO', 'S NO', 'SERIAL NO', 'STUDENT NAME', 'FULL NAME',
          'HOSTELER NAME', 'NAME OF STUDENT', 'NAME OF THE STUDENT', 'MOBILE NO',
          'CONTACT NO', 'PHONE NO', 'COLLEGE NAME', 'EDUCATIONAL INS', 'COURSE DURATION',
          'TOTAL', 'GRAND TOTAL', 'TOTAL RECORDS'
        ];

        const isTitleRow = exactHeaderTitles.includes(nameUpper) || nameUpper.startsWith('TOTAL ');

        if (isTitleRow) {
          skippedCount++;
          errors.push({
            row: row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2),
            name: studentData.name || 'Header Row',
            reason: 'Header title row skipped',
            originalRow: row
          });
          continue;
        }

        // If name was missing, attempt to extract any remaining string column
        if (!studentData.name || studentData.name.trim() === '') {
          const unmappedValues = Object.entries(row)
            .filter(([k]) => k !== '__ROWNUM__')
            .map(([, v]) => cleanString(v))
            .filter(v => v && v.length > 2 && /^[a-zA-Z\s.]+$/.test(v));

          if (unmappedValues.length > 0) {
            studentData.name = unmappedValues[0] as string;
          } else {
            skippedCount++;
            errors.push({
              row: row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2),
              name: 'No Name',
              reason: 'No valid student name found in row',
              originalRow: row
            });
            continue;
          }
        }

        // Check if mobile number is empty / missing
        if (!studentData.mobileNo || studentData.mobileNo.trim() === '') {
          failedCount++;
          errors.push({
            row: row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2),
            name: studentData.name || 'Unknown Student',
            reason: 'Mobile number is missing or empty — Record Failed',
            originalRow: row
          });
          continue;
        }

        // Create student (duplicates update existing student on import)
        await StudentAPI.create({
          ...studentData,
          isImport: true,
          name: studentData.name!
        });
        successCount++;

      } catch (err: any) {
        let displayHint = row['NAME'] || row['STUDENT NAME'] || row['FULL NAME'];
        if (!displayHint) {
          const vals = Object.values(row).filter(v => v && typeof v === 'string' && v.length > 2 && isNaN(Number(v)) && !v.includes('__ROWNUM__'));
          if (vals.length > 0) displayHint = vals[0];
        }

        const exactRow = row['__ROWNUM__'] !== undefined ? Number(row['__ROWNUM__']) + 1 : (i + 2);
        const errMsg = err.response?.data?.message || err.message || '';

        failedCount++;
        errors.push({
          row: exactRow,
          name: displayHint || 'Unknown',
          reason: errMsg,
          originalRow: row
        });
      }
    }

    const hasNotImported = failedCount > 0 || skippedCount > 0;

    // Show complete import results modal (ALWAYS SHOWN!)
    let resultHtml = `
      <div style="text-align: left; font-size: 15px;">
        <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
          <div style="margin-bottom: 8px;"><strong>Total Sheet Rows:</strong> ${dataToImport.length}</div>
          <div style="color: #16a34a; margin-bottom: 8px;"><strong>✓ Successfully Imported:</strong> ${successCount}</div>
          <div style="color: ${failedCount > 0 ? '#e11d48' : '#16a34a'}; margin-bottom: 8px;"><strong>✗ Failed / Duplicate Records:</strong> ${failedCount}</div>
          ${skippedCount > 0 ? `<div style="color: #64748b;"><strong>ℹ Blank / Subheading Rows Skipped:</strong> ${skippedCount}</div>` : ''}
        </div>
    `;

    if (errors.length > 0) {
      resultHtml += `
        <h4 style="margin: 0 0 10px 0; font-size: 15px; color: #334155;">Skipped / Failed Records:</h4>
        <div style="max-height: 250px; overflow-y: auto; background: #fff1f2; padding: 15px; border-radius: 8px; border: 1px solid #fecdd3; margin-bottom: 15px;">
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
      title: hasNotImported ? 'Import Summary & Results' : 'Import Successful!',
      html: resultHtml,
      icon: failedCount > 0 ? 'warning' : 'success',
      confirmButtonText: 'OK',
      showCancelButton: errors.length > 0,
      cancelButtonText: 'Export Failed / Skipped Records',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#0d6efd',
      width: '600px'
    }).then((result) => {
      if (errors.length > 0 && result.dismiss === Swal.DismissReason.cancel) {
        const ws = XLSX.utils.json_to_sheet(errors.map(e => ({
          ErrorRow: e.row,
          ErrorName: e.name,
          ErrorReason: e.reason,
          ...e.originalRow
        })));
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
