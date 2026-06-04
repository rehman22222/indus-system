import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';

interface VideoConsultationProps {
    appointmentId: string;
    roomUrl: string;
    token?: string;
    onEnd: () => void;
}

export function VideoConsultation({ appointmentId, roomUrl, token, onEnd }: VideoConsultationProps) {
    const iframeRef = useRef<HTMLDivElement>(null);
    const callRef = useRef<any>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!iframeRef.current || !roomUrl) return;

        let destroyed = false;

        // Dynamic import to avoid build errors
        import('@daily-co/daily-js').then(({ default: DailyIframe }) => {
            if (destroyed || !iframeRef.current) return;

            try {
                callRef.current = DailyIframe.createFrame(iframeRef.current, {
                    showLeaveButton: false,
                    showFullscreenButton: true,
                    iframeStyle: { width: '100%', height: '500px', border: '0', borderRadius: '8px' },
                });

                callRef.current
                    .on('joined-meeting', () => setIsJoined(true))
                    .on('left-meeting', () => { setIsJoined(false); onEnd(); })
                    .on('error', (e: any) => setError(e?.errorMsg || 'Connection error'));

                callRef.current.join({ url: roomUrl, token });
            } catch (e) {
                setError('Failed to initialize video call. Please try again.');
            }
        }).catch(() => {
            setError('Video library not available. Please refresh the page.');
        });

        return () => {
            destroyed = true;
            callRef.current?.destroy();
        };
    }, [roomUrl, token, onEnd]);

    const toggleVideo = () => {
        callRef.current?.setLocalVideo(!isVideoOn);
        setIsVideoOn(!isVideoOn);
    };

    const toggleAudio = () => {
        callRef.current?.setLocalAudio(!isAudioOn);
        setIsAudioOn(!isAudioOn);
    };

    const leaveCall = () => {
        callRef.current?.leave();
        onEnd();
    };

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="pt-6">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" onClick={onEnd} className="mt-4">Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5" /> Video Consultation
                    </CardTitle>
                    <Badge variant={isJoined ? 'default' : 'secondary'}>
                        {isJoined ? 'Connected' : 'Connecting...'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={iframeRef} className="w-full rounded-lg overflow-hidden" />
                <div className="flex justify-center gap-4 mt-4">
                    <Button variant="outline" size="icon" onClick={toggleVideo}>
                        {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={toggleAudio}>
                        {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="destructive" size="icon" onClick={leaveCall}>
                        <PhoneOff className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
