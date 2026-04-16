import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import CreateReply from './CreateReply';
import ReplyDetail from './ReplyDetail';
import Templates from './Templates';
import FactSummary from './FactSummary';
import ParaWiseBuilder from './ParaWiseBuilder';
import DraftEditor from './DraftEditor';
import ReviewApproval from './ReviewApproval';
import ExportView from './ExportView';
import AnnexureManager from './AnnexureManager';

export default function HcReplyModule() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="new" element={<CreateReply />} />
      <Route path="templates" element={<Templates />} />
      <Route path=":id" element={<ReplyDetail />} />
      <Route path=":id/facts" element={<FactSummary />} />
      <Route path=":id/para-wise" element={<ParaWiseBuilder />} />
      <Route path=":id/annexures" element={<AnnexureManager />} />
      <Route path=":id/editor" element={<DraftEditor />} />
      <Route path=":id/review" element={<ReviewApproval />} />
      <Route path=":id/export" element={<ExportView />} />
    </Routes>
  );
}
