 import { QRCodeSVG } from 'qrcode.react';
 import { Card } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { 
   Dialog, 
   DialogContent, 
   DialogHeader, 
   DialogTitle,
   DialogDescription,
 } from '@/components/ui/dialog';
 import { format } from 'date-fns';
 import {
   QrCode,
   Clock,
   Stethoscope,
   MapPin,
   Video,
   Download,
   Share2,
   X,
 } from 'lucide-react';
 
 interface AppointmentQRCodeProps {
   open: boolean;
   onClose: () => void;
   appointment: {
     id: string;
     token: string;
     patientId?: string;
     patientName?: string;
     appointmentTime: string;
     appointmentDate?: string;
     appointmentType: 'visit' | 'video';
     status: string;
   };
   doctor?: {
     name: string;
     specialty: string;
     branch: string;
   };
   baseUrl?: string;
 }
 
 export default function AppointmentQRCode({
   open,
   onClose,
   appointment,
   doctor,
   baseUrl = window.location.origin,
 }: AppointmentQRCodeProps) {
   // Generate check-in URL
   const checkInUrl = `${baseUrl}/check-in?token=${encodeURIComponent(appointment.token)}&pid=${encodeURIComponent(appointment.patientId || '')}`;
   
   const handleShare = async () => {
     if (navigator.share) {
       try {
         await navigator.share({
           title: 'Appointment Check-In',
           text: `Check-in for appointment with ${doctor?.name}`,
           url: checkInUrl,
         });
       } catch (err) {
         // User cancelled or error
       }
     } else {
       // Fallback: copy to clipboard
       navigator.clipboard.writeText(checkInUrl);
     }
   };
   
   const handleDownload = () => {
     const svg = document.getElementById('appointment-qr-code');
     if (svg) {
       const svgData = new XMLSerializer().serializeToString(svg);
       const canvas = document.createElement('canvas');
       const ctx = canvas.getContext('2d');
       const img = new Image();
       
       img.onload = () => {
         canvas.width = img.width;
         canvas.height = img.height;
         ctx?.drawImage(img, 0, 0);
         
         const link = document.createElement('a');
         link.download = `appointment-${appointment.token}.png`;
         link.href = canvas.toDataURL('image/png');
         link.click();
       };
       
       img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
     }
   };
   
   return (
     <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
       <DialogContent className="max-w-sm rounded-3xl">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <QrCode className="h-5 w-5 text-primary" />
             Check-In QR Code
           </DialogTitle>
           <DialogDescription>
             Show this QR code at the hospital kiosk to check in
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4">
           {/* QR Code */}
           <div className="bg-white rounded-2xl p-6 flex items-center justify-center">
             <QRCodeSVG
               id="appointment-qr-code"
               value={checkInUrl}
               size={200}
               level="H"
               includeMargin={true}
               bgColor="#ffffff"
               fgColor="#000000"
             />
           </div>
           
           {/* Appointment Info */}
           <Card className="p-4 rounded-xl bg-secondary/30 space-y-3">
             <div className="flex items-center justify-between">
               <span className="text-sm text-muted-foreground">Token</span>
               <span className="font-mono font-bold text-lg text-primary">{appointment.token}</span>
             </div>
             
             {doctor && (
               <div className="flex items-center gap-3">
                 <Stethoscope className="h-4 w-4 text-muted-foreground" />
                 <div className="flex-1">
                   <p className="font-medium text-sm">{doctor.name}</p>
                   <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                 </div>
               </div>
             )}
             
             <div className="flex items-center gap-3">
               <Clock className="h-4 w-4 text-muted-foreground" />
               <span className="text-sm">
                 {appointment.appointmentTime}
                 {appointment.appointmentDate && (
                   <span className="text-muted-foreground ml-2">
                     {format(new Date(appointment.appointmentDate), 'MMM d, yyyy')}
                   </span>
                 )}
               </span>
             </div>
             
             {doctor?.branch && (
               <div className="flex items-center gap-3">
                 <MapPin className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm">{doctor.branch}</span>
               </div>
             )}
             
             <div className="flex items-center gap-3">
               {appointment.appointmentType === 'video' ? (
                 <>
                   <Video className="h-4 w-4 text-chart-2" />
                   <Badge variant="secondary">Video Consultation</Badge>
                 </>
               ) : (
                 <>
                   <MapPin className="h-4 w-4 text-primary" />
                   <Badge variant="outline">In-Person Visit</Badge>
                 </>
               )}
             </div>
           </Card>
           
           {/* Actions */}
           <div className="flex gap-2">
             <Button
               variant="outline"
               className="flex-1 rounded-xl"
               onClick={handleDownload}
             >
               <Download className="h-4 w-4 mr-2" />
               Save
             </Button>
             <Button
               className="flex-1 rounded-xl"
               onClick={handleShare}
             >
               <Share2 className="h-4 w-4 mr-2" />
               Share
             </Button>
           </div>
           
           <p className="text-xs text-center text-muted-foreground">
             This QR code is valid for your scheduled appointment only
           </p>
         </div>
       </DialogContent>
     </Dialog>
   );
 }