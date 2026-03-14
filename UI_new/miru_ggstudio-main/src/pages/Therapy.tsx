import { useState } from 'react';
import { motion } from 'motion/react';
import { ExercisesTab } from './therapy/ExercisesTab';
import { ReportsTab } from './therapy/ReportsTab';
import { TherapyHeader } from './therapy/TherapyHeader';
import { TherapyTabs } from './therapy/TherapyTabs';
import { TherapistTab } from './therapy/TherapistTab';
import type { TherapyTabId } from './therapy/types';
import { useTherapyViewModel } from './therapy/useTherapyViewModel';

export function Therapy() {
  const [activeTab, setActiveTab] = useState<TherapyTabId>('exercises');
  const therapy = useTherapyViewModel();

  return (
    <div className="min-h-screen bg-miru-bg p-4 pb-32 md:p-8">
      <div className="mx-auto max-w-5xl">
        <TherapyHeader isLoading={therapy.isLoading} error={therapy.resolvedError} />
        <TherapyTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'exercises' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <ExercisesTab
              goals={therapy.goals}
              newGoalTitle={therapy.newGoalTitle}
              setNewGoalTitle={therapy.setNewGoalTitle}
              isSubmittingGoal={therapy.isSubmittingGoal}
              onCreateGoal={therapy.handleCreateGoal}
              onToggleGoal={therapy.handleToggleGoal}
            />
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <ReportsTab
              proactiveMessage={therapy.proactiveMessage}
              streak={therapy.streak}
              lastScore={therapy.lastScore}
              journalsCount={therapy.journals.length}
              openGoalsCount={therapy.goals.filter((goal) => !goal.completed).length}
              completedGoalsCount={therapy.goals.filter((goal) => goal.completed).length}
            />
          </motion.div>
        )}

        {activeTab === 'therapist' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <TherapistTab
              therapist={therapy.therapist}
              assignments={therapy.therapistAssignments}
              appointments={therapy.appointments}
              messages={therapy.messages}
              assignmentBusyMap={therapy.assignmentBusyMap}
              noteDrafts={therapy.noteDrafts}
              setNoteDraft={therapy.setNoteDraft}
              messageDraft={therapy.messageDraft}
              setMessageDraft={therapy.setMessageDraft}
              isSendingMessage={therapy.isSendingMessage}
              onToggleChecklist={therapy.handleToggleChecklist}
              onSaveNotes={therapy.handleSaveAssignmentNotes}
              onUploadFiles={therapy.handleUploadAssignmentFiles}
              onCompleteAssignment={therapy.handleCompleteAssignment}
              onConfirmAppointment={therapy.handleConfirmAppointment}
              onSendMessage={therapy.handleSendTherapistMessage}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
