import { useEffect } from 'react';
import { DocsContent } from '../components/docs/DocsContent.tsx';
import type { DocsDocument } from '../components/docs/docsApi.ts';
import source from '../components/docs/judgeShowcase.json';
import '../components/docs/projectDocs.css';

const showcase = source as DocsDocument;

export default function JudgePreviewPage() {
  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, []);

  return <DocsContent document={showcase}/>;
}
