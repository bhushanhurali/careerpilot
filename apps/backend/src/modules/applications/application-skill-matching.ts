// Aliases are explicit: avoid ambiguous names such as Go, R, Node, and Spring on their own.
const vocabulary: Record<string, readonly string[]> = {
  JavaScript: ['JavaScript', 'JS', 'ECMAScript'],
  TypeScript: ['TypeScript', 'TS'],
  'Node.js': ['Node.js', 'NodeJS', 'Node JS'],
  React: ['React', 'React.js', 'ReactJS'],
  'React Native': ['React Native'],
  Angular: ['Angular'],
  AngularJS: ['AngularJS', 'Angular.js'],
  'Vue.js': ['Vue.js', 'VueJS'],
  'Next.js': ['Next.js', 'NextJS'],
  'Express.js': ['Express.js', 'ExpressJS'],
  HTML: ['HTML', 'HTML5'],
  CSS: ['CSS', 'CSS3'],
  Java: ['Java'],
  Kotlin: ['Kotlin'],
  'Spring Boot': ['Spring Boot'],
  Python: ['Python'],
  Django: ['Django'],
  Flask: ['Flask'],
  FastAPI: ['FastAPI'],
  'C++': ['C++', 'CPP'],
  'C#': ['C#', 'C Sharp'],
  '.NET': ['.NET', 'Dotnet'],
  'ASP.NET': ['ASP.NET', 'ASP.NET Core'],
  Go: ['Golang'],
  Rust: ['Rust'],
  Ruby: ['Ruby'],
  'Ruby on Rails': ['Ruby on Rails'],
  PHP: ['PHP'],
  Laravel: ['Laravel'],
  Swift: ['Swift'],
  SQL: ['SQL'],
  PostgreSQL: ['PostgreSQL', 'Postgres'],
  MySQL: ['MySQL'],
  SQLite: ['SQLite'],
  'SQL Server': ['SQL Server', 'MSSQL'],
  MongoDB: ['MongoDB'],
  Redis: ['Redis'],
  Docker: ['Docker'],
  Kubernetes: ['Kubernetes', 'K8s'],
  Terraform: ['Terraform'],
  AWS: ['AWS', 'Amazon Web Services'],
  Azure: ['Microsoft Azure', 'Azure'],
  GCP: ['GCP', 'Google Cloud Platform', 'Google Cloud'],
  Git: ['Git'],
  'GitHub Actions': ['GitHub Actions'],
  Jenkins: ['Jenkins'],
  'CI/CD': ['CI/CD', 'CI / CD', 'Continuous Integration and Continuous Delivery'],
  GraphQL: ['GraphQL'],
  REST: ['REST API', 'REST APIs', 'RESTful API', 'RESTful APIs'],
  gRPC: ['gRPC'],
  Kafka: ['Kafka', 'Apache Kafka'],
  RabbitMQ: ['RabbitMQ'],
  Linux: ['Linux'],
  Bash: ['Bash'],
  PowerShell: ['PowerShell'],
  Jest: ['Jest'],
  Vitest: ['Vitest'],
  Playwright: ['Playwright'],
  Cypress: ['Cypress'],
  Selenium: ['Selenium'],
  Pandas: ['Pandas'],
  NumPy: ['NumPy'],
  PyTorch: ['PyTorch'],
  TensorFlow: ['TensorFlow'],
};

const aliasOwners = new Map(
  Object.entries(vocabulary).flatMap(([skill, aliases]) =>
    aliases.map((alias) => [alias.toLowerCase(), skill] as const),
  ),
);
const aliases = [...aliasOwners.keys()]
  .sort((left, right) => right.length - left.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
// Bare aliases that also occur in ordinary prose need their technology spelling.
const ambiguousAliases = new Set(['react', 'swift', 'rust', 'ruby', 'bash', 'jest']);

// Longest match wins at a position, so React Native and ASP.NET do not imply React and .NET.
const skillPattern = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}_+#]|[\\p{L}\\p{M}\\p{N}_]\\.)(?:${aliases.join('|')})(?![\\p{L}\\p{M}\\p{N}_+#]|\\.[\\p{L}\\p{M}\\p{N}_])`,
  'giu',
);

export function extractSkills(text: string): string[] {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ');
  const skills = new Set<string>();
  for (const [alias] of normalized.matchAll(skillPattern)) {
    const key = alias.toLowerCase();
    const skill = aliasOwners.get(key);
    if (skill && (!ambiguousAliases.has(key) || alias === skill || alias === skill.toUpperCase())) {
      skills.add(skill);
    }
  }
  return [...skills].sort();
}

export function compareSkills(description: string, resumeText: string) {
  const requiredSkills = extractSkills(description);
  const resumeSkills = new Set(extractSkills(resumeText));
  const matchedSkills = requiredSkills.filter((skill) => resumeSkills.has(skill));
  const missingSkills = requiredSkills.filter((skill) => !resumeSkills.has(skill));
  const status = !requiredSkills.length
    ? 'no_recognized_requirements'
    : !resumeSkills.size
      ? 'no_recognized_resume_skills'
      : 'compared';
  return {
    status,
    matchedSkills,
    missingSkills,
    matchedCount: matchedSkills.length,
    requiredCount: requiredSkills.length,
    coveragePercentage: requiredSkills.length
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : null,
  };
}
