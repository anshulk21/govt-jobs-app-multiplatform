import { describe, expect, it } from 'vitest';
import { extractDetails, findDates } from '../scripts/monitor/extract';

describe('findDates', () => {
  it('parses Indian date formats as day-first', () => {
    expect(findDates('15-11-2026, 05/01/2027, 1.2.26').map((d) => d.iso)).toEqual(['2026-11-15', '2027-01-05', '2026-02-01']);
    expect(findDates('15th November, 2026 and 3 Dec 2026').map((d) => d.iso)).toEqual(['2026-11-15', '2026-12-03']);
    expect(findDates('November 15, 2026').map((d) => d.iso)).toEqual(['2026-11-15']);
  });

  it('rejects impossible dates', () => {
    expect(findDates('31-02-2026 and 45/13/2026')).toEqual([]);
  });
});

const NOTICE = `
STAFF SELECTION COMMISSION
Notice: Constable (GD) Examination, 2026   Dated: 10.10.2026
Total No. of Posts: 12,000
Opening date of online application: 12-10-2026
Last date for receipt of online applications: 15.11.2026 (23:00)
Date of Computer Based Examination: January-February 2027
Age Limit: 18 to 23 years as on 01.01.2027
Application Fee: Rs. 100/- (Rupees One Hundred only). Women, SC, ST and Ex-servicemen are exempted.
Educational Qualification: Candidates must have passed Matriculation or 10th Class examination from a recognized Board.
`;

describe('extractDetails', () => {
  const d = extractDetails(NOTICE);

  it('finds vacancies, dates, age, fee and qualification', () => {
    expect(d.vacancies).toBe(12000);
    expect(d.dates).toEqual({ notification: '2026-10-10', applyStart: '2026-10-12', lastDate: '2026-11-15', exam: null });
    expect(d.ageLimit).toBe('18–23 years');
    expect(d.fee).toBe('₹100, nil for some categories');
    expect(d.qualifications).toEqual(['10th']);
  });

  it('records the exact text each value came from', () => {
    expect(d.evidence.vacancies).toBe('Total No. of Posts: 12,000');
    expect(d.evidence['dates.lastDate']).toBe('Last date for receipt of online applications: 15.11.2026');
  });

  it('never invents values that are not in the text', () => {
    const empty = extractDetails('Result of written examination declared. See merit list.');
    expect(empty.vacancies).toBeNull();
    expect(empty.ageLimit).toBeNull();
    expect(empty.fee).toBeNull();
    expect(empty.qualifications).toEqual([]);
    expect(empty.dates).toEqual({ notification: null, applyStart: null, lastDate: null, exam: null });
    expect(empty.evidence).toEqual({});
  });

  it('reads "N posts" phrasing', () => {
    expect(extractDetails('Recruitment for 2,345 posts of Junior Assistant').vacancies).toBe(2345);
  });
});

describe('extractDetails date labels', () => {
  it('reads a date on the line after a bare label (PDF tables)', () => {
    expect(extractDetails('Last Date:\n30/11/2026\nOther stuff').dates.lastDate).toBe('2026-11-30');
  });

  it('does not borrow a date from an unrelated next line', () => {
    expect(extractDetails('Date of Examination: to be announced\nAge as on 01.01.2027').dates.exam).toBeNull();
  });
});

describe('extractDetails safety checks', () => {
  it('does not mistake the word "be" for B.E. (engineering)', () => {
    const q = extractDetails('Educational Qualification: Candidates must be graduates. A degree (Graduation) in any discipline.').qualifications;
    expect(q).toEqual(['graduate']);
    expect(extractDetails('Eligibility: B.E./B.Tech in Civil Engineering').qualifications).toEqual(['engineering']);
  });

  it('drops dates implausibly far from when the notice was found', () => {
    const d = extractDetails('Dated: 26.04.2013\nLast date for online application: 20.07.2026', '2026-06-30').dates;
    expect(d.notification).toBeNull();
    expect(d.lastDate).toBe('2026-07-20');
    expect(extractDetails('Last date: 15.11.2031', '2026-10-20').dates.lastDate).toBeNull();
  });
});

describe('extractDetails: tables and ranges', () => {
  const TABLE = `Important Dates
Opening date and closing date for on-line
registration in Website
23.09.2026 to 12.10.2026
[both days inclusive]
Number of Training seats 3500`;

  it('takes the end of a date range as the last date, even when the cell is split over lines', () => {
    const d = extractDetails(TABLE, '2026-09-25');
    expect(d.dates.lastDate).toBe('2026-10-12');
    expect(d.evidence['dates.lastDate']).toContain('23.09.2026 to 12.10.2026');
  });

  it('counts training seats as vacancies', () => {
    expect(extractDetails(TABLE, '2026-09-25').vacancies).toBe(3500);
  });

  it('never borrows a date when the label line already answers', () => {
    expect(extractDetails('Last date: will be notified later\nAge as on 01.01.2027').dates.lastDate).toBeNull();
  });
});
