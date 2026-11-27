import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Project } from '../data/construction.ts';
import { ProjectPopup } from './ProjectPopup.tsx';

const project: Project = {
  id: 'tlv-permit-1',
  city: 'tel-aviv',
  kind: 'building',
  title: 'בניה חדשה – בניין מגורים',
  address: 'דיזנגוף 100',
  position: [32.07, 34.77],
  shapes: [],
  phases: [
    { since: 2024, status: 'permitted' },
    { since: 2025.25, status: 'construction' },
  ],
  until: 2028.25,
  untilEstimated: true,
  stage: 'עבודות עפר וביסוס',
  units: 12,
  tama38: true,
  link: 'https://archive-binyan.tel-aviv.gov.il/x',
};

describe('ProjectPopup', () => {
  it('shows what is built, its phases with dates, the details and the source', () => {
    render(<ProjectPopup project={project} fetchedAt="2026-11-27T01:00:00.000Z" />);
    expect(screen.getByText('בניה חדשה – בניין מגורים')).toBeInTheDocument();
    expect(screen.getByText('2024Q1–2025Q1')).toBeInTheDocument();
    expect(screen.getByText('2025Q2–2028Q1')).toBeInTheDocument();
    expect(screen.getByText(/סיום משוער/)).toBeInTheDocument();
    expect(screen.getByText(/12 יח״ד · תמ״א 38/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'התיק באתר העירייה' })).toHaveAttribute('href', project.link);
    expect(screen.getByText(/עיריית תל אביב–יפו · עודכן 27\/11\/2026/)).toBeInTheDocument();
  });
});
