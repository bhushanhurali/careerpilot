import { describe, expect, it } from 'vitest';

import { compareSkills, extractSkills } from './application-skill-matching.js';

describe('application skill matching', () => {
  it('normalizes aliases, Unicode, and whitespace and deduplicates skills', () => {
    expect(
      extractSkills('JS, JavaScript, ＴＳ, NODE.js, NodeJS, Spring\nBoot, Postgres, K8s'),
    ).toEqual(['JavaScript', 'Kubernetes', 'Node.js', 'PostgreSQL', 'Spring Boot', 'TypeScript']);
  });

  it('respects word boundaries and prefers specific technologies over overlapping aliases', () => {
    expect(
      extractSkills(
        'JavaScript, React Native, ASP.NET Core, NoSQL, GitHub, C++17, x.py, Java. C++ / C#',
      ),
    ).toEqual(['ASP.NET', 'C#', 'C++', 'Java', 'JavaScript', 'React Native']);
    expect(extractSkills('go with spring, parts, tools.js, node, breakfast')).toEqual([]);
  });

  it('returns unique requirements, gaps, and rounded coverage', () => {
    expect(compareSkills('JS, JavaScript, TS, Docker', 'TypeScript and JS')).toEqual({
      status: 'compared',
      matchedSkills: ['JavaScript', 'TypeScript'],
      missingSkills: ['Docker'],
      matchedCount: 2,
      requiredCount: 3,
      coveragePercentage: 67,
    });
  });

  it('distinguishes undefined coverage from zero coverage', () => {
    expect(compareSkills('Teamwork', 'JS')).toMatchObject({
      status: 'no_recognized_requirements',
      coveragePercentage: null,
      requiredCount: 0,
    });
    expect(compareSkills('JS', 'Teamwork')).toMatchObject({
      status: 'no_recognized_resume_skills',
      coveragePercentage: 0,
      missingSkills: ['JavaScript'],
    });
    expect(compareSkills('JS', 'Docker')).toMatchObject({
      status: 'compared',
      coveragePercentage: 0,
    });
  });
});
