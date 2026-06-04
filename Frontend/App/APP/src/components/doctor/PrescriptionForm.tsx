import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHospitalData } from '@/contexts/HospitalDataContext';
import { Plus, Trash2, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PrescriptionFormProps {
  patient: any;
  doctorId: string;
  doctorName: string;
  onComplete: () => void;
}

interface PrescriptionItem {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export function PrescriptionForm({ patient, doctorId, doctorName, onComplete }: PrescriptionFormProps) {
  const { createPrescription, getMedications } = useHospitalData();
  const medications = getMedications();
  
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([{
    medicationId: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
  }]);

  const addMedication = () => {
    setItems([...items, {
      medicationId: '',
      medicationName: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: '',
    }]);
  };

  const removeMedication = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Update medication name when medication is selected
    if (field === 'medicationId') {
      const med = medications.find(m => m.id === value);
      if (med) {
        newItems[index].medicationName = `${med.name} (${med.strength})`;
      }
    }
    
    setItems(newItems);
  };

  const handleSave = () => {
    if (!diagnosis.trim()) {
      toast({
        title: "Error",
        description: "Please enter a diagnosis",
        variant: "destructive",
      });
      return;
    }

    if (items.some(item => !item.medicationId || !item.dosage || !item.frequency || !item.duration)) {
      toast({
        title: "Error",
        description: "Please complete all medication details",
        variant: "destructive",
      });
      return;
    }

    createPrescription({
      patientId: patient.id,
      patientName: patient.name,
      doctorId,
      doctorName,
      date: new Date().toISOString(),
      diagnosis,
      items,
      notes,
    });

    toast({
      title: "Prescription Created",
      description: "Prescription saved successfully",
    });

    onComplete();
  };

  const handlePrint = () => {
    toast({
      title: "Print",
      description: "Prescription sent to printer",
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Diagnosis</Label>
        <Input
          placeholder="Enter diagnosis"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg">Medications</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMedication}
            className="rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Medication
          </Button>
        </div>

        {items.map((item, index) => (
          <Card key={index} className="p-4 rounded-2xl border-2">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <Label>Medication {index + 1}</Label>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMedication(index)}
                    className="rounded-xl text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Select
                value={item.medicationId}
                onValueChange={(value) => updateItem(index, 'medicationId', value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select medication" />
                </SelectTrigger>
                <SelectContent>
                  {medications.map((med) => (
                    <SelectItem key={med.id} value={med.id}>
                      {med.name} ({med.strength}) - {med.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Dosage</Label>
                  <Input
                    placeholder="e.g., 1 tablet"
                    value={item.dosage}
                    onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs">Frequency</Label>
                  <Input
                    placeholder="e.g., 3 times/day"
                    value={item.frequency}
                    onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Duration</Label>
                <Input
                  placeholder="e.g., 7 days"
                  value={item.duration}
                  onChange={(e) => updateItem(index, 'duration', e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs">Instructions</Label>
                <Input
                  placeholder="e.g., After meals"
                  value={item.instructions}
                  onChange={(e) => updateItem(index, 'instructions', e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Clinical Notes</Label>
        <Textarea
          placeholder="Enter additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl min-h-24"
        />
      </div>

      <div className="flex gap-3">
        <Button
          className="flex-1 rounded-xl"
          size="lg"
          onClick={handleSave}
        >
          Save Prescription
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handlePrint}
          className="rounded-xl"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>
    </div>
  );
}
