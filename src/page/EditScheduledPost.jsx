import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ScheduledPostEditor from '../components/studio/ScheduledPostEditor';

// Standalone page at /edit-scheduled/:permlink (used by the draft studio).
// The watch page opens the same editor in a popup instead — see EditScheduledModal.
export default function EditScheduledPost() {
  const { permlink } = useParams();
  const navigate = useNavigate();
  const back = () => navigate('/draft');
  return (
    <ScheduledPostEditor
      permlink={permlink}
      onClose={back}
      onSaved={back}
      onCancelled={back}
    />
  );
}
