import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Download, FileText, Leaf, Link2, Search, Users } from 'lucide-react';
import { dhakaDate, type DocsDocument, type Live, type Section } from './docsApi.ts';

function Diagram({ nodes, title }: { nodes: string[]; title: string }) {
  const width = nodes.length * 188;
  return <div className="akdocs-diagram" tabIndex={0} aria-label={title}>
    <svg viewBox={`0 0 ${width} 76`} role="img" aria-label={nodes.join(' → ')} width={width} height="76">
      {nodes.map((node, index) => {
        const x = index * 188;
        const lines = node.match(/.{1,23}(?:\s|$)|.{1,23}/gu)?.map(line => line.trim()).filter(Boolean) ?? [node];
        return <g key={index}>
          <rect x={x + 2} y="3" width="155" height="68" rx="12" className="akdocs-node" />
          <text x={x + 79} y={40 - (Math.min(lines.length, 3) - 1) * 8} textAnchor="middle">
            {lines.slice(0, 3).map((line, i) => <tspan key={i} x={x + 79} dy={i ? 16 : 0}>{i === 2 && lines.length > 3 ? line + '…' : line}</tspan>)}
          </text>
          {index + 1 < nodes.length && <path d={`M${x + 162} 37h21m-6 -5 6 5-6 5`} className="akdocs-arrow" />}
        </g>;
      })}
    </svg>
  </div>;
}

const number = new Intl.NumberFormat('en-BD');
const labels = {
  registered_accounts: 'Registered accounts', prediction_events: 'Prediction events', approved_listings: 'Approved listings',
} as const;

function Team({ document }: { document: DocsDocument }) {
  return <>
    {document.team_name && <p className="akdocs-team-name"><Users size={17} aria-hidden />{document.team_name}</p>}
    {!!document.team.length && <div className="akdocs-team">
      {document.team.map((member, index) => <article className="akdocs-person" key={index}>
        {member.photo ? <img src={member.photo} alt="" width="72" height="72" loading="lazy" />
          : <span className="akdocs-avatar" aria-hidden>{member.name.trim().split(/\s+/).slice(0, 2).map(word => [...word][0]).join('')}</span>}
        <h3>{member.name}</h3><p>{member.role}</p>
        {member.show_email && member.email && <a href={`mailto:${member.email}`}>{member.email}</a>}
      </article>)}
    </div>}
  </>;
}

function Supplement({ section, document, live }: { section: Section; document: DocsDocument; live?: Live }) {
  switch (section.id) {
    case 'team': return <Team document={document} />;
    case 'contributors': return <a href="#team">View the team directory</a>;
    case 'architecture': return <Diagram nodes={document.architecture} title="System architecture" />;
    case 'data-flow': return <Diagram nodes={document.data_flow} title="Data flow" />;
    case 'product-demo': return <div className="akdocs-actions"><Link className="akdocs-button akdocs-primary" to="/workspace?tab=dashboard">Open the workspace <ArrowUpRight size={16}/></Link><Link className="akdocs-button" to="/buyer">Buyer marketplace <ArrowUpRight size={16}/></Link></div>;
    case 'features': return <div className="akdocs-table"><table>
      <thead><tr><th>Capability</th><th>Status</th></tr></thead>
      <tbody>{[...(live?.features ?? []), ...document.roadmap].map((feature, i) => <tr key={i}><td>{feature.name}</td><td><span data-status={feature.status}>{feature.status}</span></td></tr>)}</tbody>
    </table></div>;
    case 'api': return live && <div className="akdocs-table"><table>
      <thead><tr><th>Method and route</th><th>Purpose</th><th>Access</th></tr></thead>
      <tbody>{live.endpoints.map(endpoint => <tr key={endpoint.path}><td><small>{endpoint.methods.join(' · ')}</small><code>{endpoint.path}</code></td><td>{endpoint.description}</td><td>{endpoint.auth}</td></tr>)}</tbody>
    </table></div>;
    case 'analytics': return live?.metrics && <div className="akdocs-metrics">{Object.entries(live.metrics).map(([key, value]) => <div key={key}><strong>{number.format(value)}</strong><span>{labels[key as keyof typeof labels]}</span></div>)}</div>;
    case 'changelog': return live && <>
      <p>API v{live.version}</p>
      {!!live.changelog?.length && <ul className="akdocs-releases">{live.changelog.map(entry => <li key={entry.revision}><strong>Revision {entry.revision}</strong><span>{dhakaDate.format(entry.published_at * 1000)} · {entry.title}</span></li>)}</ul>}
    </>;
    default: return null;
  }
}

function markdown(document: DocsDocument, live?: Live) {
  const safe = (value: string) => value.replace(/[\\<>&#*_\x60\[\]{}|!]/g, char => char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : '\\' + char);
  const supplement: Record<string, string[]> = {
    team: [safe(document.team_name), ...document.team.map(member =>
      `- ${safe(member.name)} — ${safe(member.role)}${member.show_email && member.email ? ' · ' + safe(member.email) : ''}`)],
    contributors: ['[View the team directory](#team)'],
    architecture: [document.architecture.map(safe).join(' → ')],
    'data-flow': [document.data_flow.map(safe).join(' → ')],
    features: [...(live?.features ?? []), ...document.roadmap].map(feature => `- ${safe(feature.name)} — ${feature.status}`),
    api: live?.endpoints.map(endpoint => `- ${endpoint.methods.join(', ')} ${safe(endpoint.path)} — ${safe(endpoint.description)} (${safe(endpoint.auth)})`) ?? [],
    analytics: live?.metrics ? Object.entries(live.metrics).map(([key, value]) => `- ${labels[key as keyof typeof labels]} — ${value}`) : [],
    changelog: live ? [`API v${live.version}`, ...(live.changelog ?? []).map(entry => `- Revision ${entry.revision} · ${dhakaDate.format(entry.published_at * 1000)} · ${safe(entry.title)}`)] : [],
  };
  return [
    `# ${safe(document.title)}`, safe(document.tagline),
    ...document.sections.flatMap(section => [
      `## ${safe(section.title)}`,
      ...section.blocks.map(block => `${block.kind === 'heading' ? '### ' : block.kind === 'bullet' ? '- ' : ''}${safe(block.text)}`),
      ...(supplement[section.id] ?? []),
    ]),
  ].join('\n\n');
}

type Props = { document: DocsDocument; live?: Live; revision?: number; preview?: boolean };
export function DocsContent({ document, live, revision, preview = false }: Props) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const sections = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return document.sections.filter(section => {
      const extra = section.id === 'team' ? document.team.map(member => `${member.name} ${member.role}`).join(' ')
        : section.id === 'features' ? [...(live?.features ?? []), ...document.roadmap].map(feature => `${feature.name} ${feature.status}`).join(' ')
        : section.id === 'api' && live ? live.endpoints.map(endpoint => `${endpoint.path} ${endpoint.description} ${endpoint.auth}`).join(' ') : '';
      const text = [section.title, section.group, extra, ...section.blocks.map(block => block.text)].join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
  }, [document, live, query]);

  const matchedIds = new Set(sections.map(section => section.id));

  function exportMarkdown() {
    const url = URL.createObjectURL(new Blob([markdown(document, live)], { type: 'text/markdown;charset=utf-8' }));
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = 'amader-krishi-ai-docs.md';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="akdocs">
    <header className="akdocs-top">
      <Link className="akdocs-brand" to="/"><Leaf size={22} aria-hidden/><span>আমাদের কৃষি AI</span></Link>
      {!preview && <div className="akdocs-actions">
        <button className="akdocs-button" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(window.location.href); setNote('Link copied.'); }
          catch { setNote('Copy the URL from your browser’s address bar.'); }
        }}><Link2 size={16}/>Share</button>
        <button className="akdocs-button" type="button" onClick={exportMarkdown}><Download size={16}/>Markdown</button>
        <button className="akdocs-button" type="button" onClick={() => window.print()}><FileText size={16}/>Print / PDF</button>
      </div>}
    </header>
    {!!note && <p role="status" className="akdocs-note">{note}</p>}
    <section className="akdocs-hero">
      <div><p>{!live ? 'AI Builders Congress 2026 · Judge Preview' : preview ? 'Product documentation · Draft' : `Product documentation · Revision ${revision}`}</p>
        <h1>{document.title}</h1><p>{document.tagline}</p>
      </div>
      {live ? <span className="akdocs-model-count"><strong>{live.registered_models}</strong> registered models</span> : <Link className="akdocs-button" to="/admin">Try the admin demo <ArrowUpRight size={16}/></Link>}
    </section>
    <div className="akdocs-layout">
      <aside className="akdocs-sidebar">
        <label className="akdocs-search"><Search size={17} aria-hidden/><input type="search" placeholder="Search documentation" aria-label="Search documentation" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <nav aria-label="Documentation sections">
          {(['pitch', 'technical'] as const).map(group => <div key={group}>
            <strong>{group === 'pitch' ? 'Pitch deck' : 'Technical documentation'}</strong>
            {sections.filter(section => section.group === group).map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          </div>)}
        </nav>
      </aside>
      <div className="akdocs-sections">
        {live && <div className="akdocs-live"><span>Live application snapshot</span><time dateTime={new Date(live.as_of * 1000).toISOString()}>{dhakaDate.format(live.as_of * 1000)} Dhaka</time></div>}
        {document.sections.map(section => <section className="akdocs-section" hidden={!matchedIds.has(section.id)} id={section.id} key={section.id} aria-labelledby={`heading-${section.id}`}>
          <div className="akdocs-section-title"><h2 id={`heading-${section.id}`}>{section.title}</h2><a href={`#${section.id}`} aria-label={`Link to ${section.title}`}><Link2 size={17}/></a></div>
          {section.blocks.map((block, i) => block.kind === 'heading' ? <h3 key={i}>{block.text}</h3>
            : block.kind === 'bullet' ? <p key={i} className="akdocs-bullet">{block.text}</p> : <p key={i}>{block.text}</p>)}
          <Supplement section={section} document={document} live={live} />
        </section>)}
        {!sections.length && <p className="akdocs-section akdocs-no-matches" role="status">No sections match “{query}”.</p>}
      </div>
    </div>
  </div>;
}
