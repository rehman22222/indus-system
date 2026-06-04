import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useHospitalData } from '@/contexts/HospitalDataContext';
import { Calendar, FileText, Pill, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PatientHistoryProps {
  patientId: string;
}

export function PatientHistory({ patientId }: PatientHistoryProps) {
  const { getPatientHistory } = useHospitalData();
  const history = getPatientHistory(patientId);

  const handlePrint = (prescriptionId: string) => {
    toast({
      title: "Print",
      description: "Prescription sent to printer",
    });
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No medical history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
      {history.map((entry) => (
        <Card key={entry.id} className="p-6 rounded-2xl border-2">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground">Dr. {entry.doctorName}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePrint(entry.prescription.id)}
                className="rounded-xl"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>

            {/* Diagnosis */}
            <div>
              <Badge variant="secondary" className="rounded-full">
                Diagnosis
              </Badge>
              <p className="mt-2 text-foreground">{entry.diagnosis}</p>
            </div>

            <Separator />

            {/* Prescription */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Prescription</span>
              </div>

              <div className="space-y-2">
                {entry.prescription.items.map((item, idx) => (
                  <div key={idx} className="bg-secondary/50 p-3 rounded-xl">
                    <p className="font-medium text-foreground">{item.medicationName}</p>
                    <div className="mt-1 text-sm text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium">Dosage:</span> {item.dosage} • {item.frequency}
                      </p>
                      <p>
                        <span className="font-medium">Duration:</span> {item.duration}
                      </p>
                      {item.instructions && (
                        <p>
                          <span className="font-medium">Instructions:</span> {item.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {entry.notes && (
              <>
                <Separator />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Clinical Notes:</span>
                  <p className="mt-1 text-sm text-foreground">{entry.notes}</p>
                </div>
              </>
            )}

            {/* Follow-up */}
            {entry.followUpDate && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Follow-up:</span>
                  <span className="font-medium text-foreground">
                    {new Date(entry.followUpDate).toLocaleDateString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
