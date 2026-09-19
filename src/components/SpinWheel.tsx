import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../lib/sound';
import { TicketSelection } from '../types/index';

interface SpinWheelProps {
  winningNumber?: number | null;
  isSpinning?: boolean;
  onSpinEnd?: (number: number) => void;
  claimedNumbers?: number[];
  selections?: Record<number, TicketSelection>;
  winnerInfo?: {
    number: number;
    userName?: string;
    userPhone?: string;
    rank?: 1 | 2 | 3;
    prize?: number;
  } | null;
  onSelectNumber?: (num: number) => void;
  userTickets?: number[];
  spinDuration?: number;
  spinKey?: string | number;
}

export const SpinWheel: React.FC<SpinWheelProps> = ({
  winningNumber,
  isSpinning = false,
  onSpinEnd,
  claimedNumbers = [],
  selections = {},
  winnerInfo = null,
  onSelectNumber,
  userTickets = [],
  spinDuration = 15000,
  spinKey,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [lightPhase, setLightPhase] = useState(0);
  const [inspectedNum, setInspectedNum] = useState<number | null>(null);
  const [spinCountdown, setSpinCountdown] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [revealedWinner, setRevealedWinner] = useState<{
    number: number;
    userName?: string;
    userPhone?: string;
    rank?: 1 | 2 | 3;
    prize?: number;
  } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isSpinningRef = useRef(false);

  const totalNumbers = 100;
  const segmentAngle = (2 * Math.PI) / totalNumbers;

  // Ultra-vibrant chasing lights marquee animation with radiant speed
  useEffect(() => {
    const intervalTime = isSpinning ? 50 : 110;
    const lightInterval = setInterval(() => {
      setLightPhase((prev) => (prev + 1) % 36);
    }, intervalTime);
    return () => clearInterval(lightInterval);
  }, [isSpinning]);

  // Calculate pointed number at top needle position
  const normalizedAngle = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const localPointerAngle = ((-Math.PI / 2 - normalizedAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const rawPointedNum = Math.floor(localPointerAngle / segmentAngle) + 1;
  const pointedNumber = rawPointedNum > 100 ? 1 : rawPointedNum < 1 ? 100 : rawPointedNum;

  // Active display number in center hub - STRICT RULE: Never show winning number while spinning!
  const isWinnerRevealed = !isSpinning && Boolean(revealedWinner);
  const activeDisplayNum = isWinnerRevealed && revealedWinner
    ? revealedWinner.number
    : isSpinning
    ? pointedNumber
    : inspectedNum || pointedNumber;

  // Draw the high-definition vibrant machine canvas
  const drawWheel = (angle: number, phase: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 40; // Room for double golden bezel and lights

    ctx.clearRect(0, 0, size, size);

    // Save context for wheel rotation
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);

    // High-visibility vibrant casino palette with alternating contrast
    const sliceColors = [
      '#dc2626', // Vivid Red
      '#2563eb', // Royal Blue
      '#059669', // Emerald Green
      '#7c3aed', // Purple
      '#ea580c', // Bright Orange
      '#0284c7', // Sky Blue
      '#db2777', // Hot Pink
      '#16a34a', // Bright Green
      '#4f46e5', // Indigo
      '#d97706', // Warm Amber
    ];

    // 1. Draw 100 Segments
    for (let i = 1; i <= totalNumbers; i++) {
      const startAngle = (i - 1) * segmentAngle;
      const endAngle = i * segmentAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      const selection = selections[i];
      const isClaimed = !!selection || claimedNumbers.includes(i);
      const isWinner = isWinnerRevealed && revealedWinner?.number === i;

      if (isWinner) {
        // Glowing radiant gold/neon
        const winGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, radius);
        winGrad.addColorStop(0, '#ffffff');
        winGrad.addColorStop(0.3, '#fef08a');
        winGrad.addColorStop(1, '#eab308');
        ctx.fillStyle = winGrad;
      } else if (isClaimed) {
        // High-contrast vibrant Crimson/Ruby gradient for claimed slots ("lakk qabameef color biraa")
        const claimedGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, radius);
        claimedGrad.addColorStop(0, '#fecdd3');
        claimedGrad.addColorStop(0.35, '#e11d48');
        claimedGrad.addColorStop(1, '#881337');
        ctx.fillStyle = claimedGrad;
      } else {
        ctx.fillStyle = sliceColors[i % sliceColors.length];
      }
      ctx.fill();

      // Sharp high-contrast segment separator line
      ctx.strokeStyle = isWinner ? '#ffffff' : isClaimed ? '#fda4af' : 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = isWinner ? 2.5 : isClaimed ? 1.5 : 0.8;
      ctx.stroke();

      // Outer golden stud on perimeter of each segment
      const pegAngle = startAngle;
      const pegX = (radius - 4) * Math.cos(pegAngle);
      const pegY = (radius - 4) * Math.sin(pegAngle);
      ctx.beginPath();
      ctx.arc(pegX, pegY, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = isWinner ? '#ffffff' : isClaimed ? '#ffe4e6' : '#fef08a';
      ctx.fill();

      // ULTRA-VISIBLE NUMBER RENDERING (VISIBLE FROM ACROSS THE ROOM / STREAM)
      // Staggered tracks: Odd numbers at outer track, Even numbers at inner track
      const isOdd = i % 2 !== 0;
      const numDist = isOdd ? radius - 23 : radius - 58;

      ctx.save();
      const textAngle = startAngle + segmentAngle / 2;
      ctx.rotate(textAngle);

      // Move to badge position on radial ray
      ctx.translate(numDist, 0);

      // Tangential rotation: numbers align with wheel perimeter (upright at pointer at 12 o'clock)
      ctx.rotate(Math.PI / 2);

      const isUser = userTickets.includes(i);
      const isInspected = inspectedNum === i || pointedNumber === i;

      // High-contrast badge backing
      ctx.beginPath();
      ctx.arc(0, 0, 13.5, 0, 2 * Math.PI);

      if (isWinner) {
        // Pulsing emerald winner badge
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isUser) {
        // Radiant green user's ticket badge
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isClaimed) {
        // Radiant Crimson / Rose Red badge for claimed numbers ("lakk qabameef color biraa")
        ctx.fillStyle = '#e11d48';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        // Pure Crisp White lottery badge with bold dark outline for 100% clarity
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#09090b';
        ctx.stroke();
      }

      // Highlight ring if currently inspected or pointed
      if (isInspected) {
        ctx.beginPath();
        ctx.arc(0, 0, 16.5, 0, 2 * Math.PI);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }

      // Render Number in Ultra-Bold, Crystal-Clear Display Font
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isWinner) {
        ctx.font = '900 16px "Impact", "Arial Black", system-ui, sans-serif';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(i.toString(), 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(i.toString(), 0, 0);
      } else if (isUser) {
        ctx.font = '900 15px "Impact", "Arial Black", system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(i.toString(), 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(i.toString(), 0, 0);
      } else if (isClaimed) {
        // Bold White text on Crimson Rose Badge - crisp and unmistakable!
        ctx.font = '900 15px "Impact", "Arial Black", system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(i.toString(), 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(i.toString(), 0, 0);
      } else {
        // Bold Black text on Crisp White Badge - Extreme legibility!
        ctx.font = '900 15px "Impact", "Arial Black", system-ui, sans-serif';
        ctx.fillStyle = '#09090b';
        ctx.fillText(i.toString(), 0, 0);
      }

      ctx.restore();
    }

    // 2. Outer Bezel & Chrome Rings (Drawn on rotating wheel)
    // Dark separator ring
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, 2 * Math.PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#09090b';
    ctx.stroke();

    // Radiant Gold Chrome Outer Rim
    ctx.beginPath();
    ctx.arc(0, 0, radius + 9, 0, 2 * Math.PI);
    ctx.lineWidth = 10;
    const goldGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.2, '#f59e0b');
    goldGrad.addColorStop(0.5, '#fffbeb');
    goldGrad.addColorStop(0.8, '#d97706');
    goldGrad.addColorStop(1, '#b45309');
    ctx.strokeStyle = goldGrad;
    ctx.stroke();

    // Outer Dark Bezel
    ctx.beginPath();
    ctx.arc(0, 0, radius + 15, 0, 2 * Math.PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#18181b';
    ctx.stroke();

    ctx.restore(); // Restore context to stationary frame!

    // 3. Luxurious Center Golden Hub (Stationary, upright, crystal clear)
    ctx.save();
    ctx.translate(center, center);

    // Outer Hub Glow Ring
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, 2 * Math.PI);
    const hubGold = ctx.createRadialGradient(0, 0, 8, 0, 0, 48);
    hubGold.addColorStop(0, '#ffffff');
    hubGold.addColorStop(0.25, '#fde047');
    hubGold.addColorStop(0.65, '#f59e0b');
    hubGold.addColorStop(1, '#78350f');
    ctx.fillStyle = hubGold;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Inner Obsidian Digital Core
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, 2 * Math.PI);
    ctx.fillStyle = '#050505';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Inner 12-LED chasing ring inside hub - radiant jewel lights
    for (let h = 0; h < 12; h++) {
      const hAngle = (h / 12) * 2 * Math.PI;
      const hx = 32 * Math.cos(hAngle);
      const hy = 32 * Math.sin(hAngle);
      const isHubLit = (h + Math.floor(phase / 2)) % 3 === 0;

      // Glow halo for lit inner LED
      if (isHubLit) {
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(hx, hy, 2.5, 0, 2 * Math.PI);
      const innerBulbGrad = ctx.createRadialGradient(hx - 0.5, hy - 0.5, 0.5, hx, hy, 2.5);
      if (isHubLit) {
        innerBulbGrad.addColorStop(0, '#ffffff');
        innerBulbGrad.addColorStop(0.5, '#fde047');
        innerBulbGrad.addColorStop(1, '#eab308');
      } else {
        innerBulbGrad.addColorStop(0, '#71717a');
        innerBulbGrad.addColorStop(1, '#27272a');
      }
      ctx.fillStyle = innerBulbGrad;
      ctx.fill();
    }

    // High-Contrast Active Number Readout Inside Center Core - Upright & razor sharp!
    const currentHubNum = activeDisplayNum;
    const hubSelection = selections[currentHubNum];
    const isHubClaimed = !!hubSelection || claimedNumbers.includes(currentHubNum);
    const isHubUser = userTickets.includes(currentHubNum);

    if (isWinnerRevealed && revealedWinner) {
      // Winner Golden / Emerald Celebration (ONLY REVEALED AFTER WHEEL COMPLETELY STOPS)
      ctx.fillStyle = '#fde047';
      ctx.font = '900 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("🎉 CONGRA!", 0, -17);

      ctx.fillStyle = '#4ade80';
      ctx.font = '900 24px monospace';
      ctx.fillText(`#${revealedWinner.number}`, 0, 0);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText("MO'ATAA!", 0, 16);
    } else if (isSpinning) {
      // Spinning state: live needle pointer ticks segment by segment!
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("NAANNA'AA...", 0, -17);

      ctx.fillStyle = '#fde047';
      ctx.font = '900 24px monospace';
      ctx.fillText(`#${pointedNumber}`, 0, 0);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText("SPINNING", 0, 16);
    } else {
      // Direct Live Display of Active / Pointed Number
      ctx.fillStyle = isHubUser ? '#34d399' : isHubClaimed ? '#f43f5e' : '#38bdf8';
      ctx.font = '900 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        isHubUser ? 'TIKKEETII KEESSAN' : isHubClaimed ? 'QABAMEERA' : 'CARRAA KEE YAALI',
        0,
        -17
      );

      ctx.fillStyle = isHubUser ? '#10b981' : isHubClaimed ? '#fb7185' : '#ffffff';
      ctx.font = '900 24px monospace';
      ctx.fillText(`#${currentHubNum}`, 0, 0);

      ctx.fillStyle = isHubUser ? '#6ee7b7' : isHubClaimed ? '#fda4af' : '#4ade80';
      ctx.font = 'bold 8px system-ui, sans-serif';
      const labelText = isHubUser
        ? 'KEE'
        : isHubClaimed
        ? (hubSelection?.userName ? hubSelection.userName.slice(0, 9) : 'QABAMEERA')
        : '50 ETB';
      ctx.fillText(labelText, 0, 16);
    }

    ctx.restore(); // Restore center hub translation

    // 4. Fixed Stationary Top Pointer with High-Power Radiant Beam & Gem Flare
    ctx.save();
    ctx.translate(center, 12);

    // Radiant Downward Spotlight / Laser Beam pointing right at the active slice
    const beamGrad = ctx.createRadialGradient(0, 42, 2, 0, 42, 34);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    beamGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.65)');
    beamGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.35)');
    beamGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.beginPath();
    ctx.arc(0, 42, 34, 0, 2 * Math.PI);
    ctx.fillStyle = beamGrad;
    ctx.fill();

    // Pointer Shadow
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 46);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fill();

    // Pointer Body: Gleaming Fire Ruby & Gold
    ctx.beginPath();
    ctx.moveTo(-16, -2);
    ctx.lineTo(16, -2);
    ctx.lineTo(0, 44);
    ctx.closePath();
    const ptrGrad = ctx.createLinearGradient(-16, 0, 16, 44);
    ptrGrad.addColorStop(0, '#fecdd3');
    ptrGrad.addColorStop(0.25, '#f43f5e');
    ptrGrad.addColorStop(0.7, '#be123c');
    ptrGrad.addColorStop(1, '#fde047');
    ctx.fillStyle = ptrGrad;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Gleaming Diamond Jewel at Pointer Pivot
    ctx.beginPath();
    ctx.arc(0, 12, 8, 0, 2 * Math.PI);
    const jewelGrad = ctx.createRadialGradient(-2, 10, 1, 0, 12, 8);
    jewelGrad.addColorStop(0, '#ffffff');
    jewelGrad.addColorStop(0.3, '#fef08a');
    jewelGrad.addColorStop(0.7, '#f59e0b');
    jewelGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = jewelGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Sparkling Gem Cross Glint on Jewel
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 12, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  };

  useEffect(() => {
    drawWheel(currentAngle, lightPhase);
  }, [currentAngle, lightPhase, claimedNumbers, selections, winningNumber, activeDisplayNum]);

  // Announce winner verbally with clear voice in Afaan Oromoo & English
  const announceWinner = (targetNum: number, info?: { number?: number; userName?: string; userPhone?: string; rank?: 1 | 2 | 3; prize?: number } | null) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const rankStr = info?.rank === 1 ? '1ffaa' : info?.rank === 2 ? '2ffaa' : info?.rank === 3 ? '3ffaa' : '';
        const nameStr = info?.userName ? info.userName : 'Abbaa Carraa';
        const prizeStr = info?.prize ? `${info.prize} Birr` : '';
        const phrase = `Baga gammaddan! Carraan ${rankStr} baheera! Lakkoofsi caaraa ${targetNum}! ${nameStr} ${prizeStr}. Winning number is ${targetNum}!`;
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.rate = 0.90;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

  // Align needle statically to winning number when not actively spinning
  useEffect(() => {
    if (!isSpinning && winningNumber && !isSpinningRef.current) {
      const desiredAngle = -Math.PI / 2 - (winningNumber - 0.5) * segmentAngle;
      setCurrentAngle(desiredAngle);
    }
  }, [winningNumber, isSpinning, segmentAngle]);

  // Trigger real 15-second spin whenever isSpinning turns true or a new spinKey/winningNumber step arrives
  useEffect(() => {
    if (isSpinning) {
      const target = winningNumber || Math.floor(Math.random() * 100) + 1;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isSpinningRef.current = false;
      spinToNumber(target, 15000);
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isSpinningRef.current = false;
      setSpinCountdown(null);
    }
  }, [isSpinning, spinKey, winningNumber, spinDuration]);

  const spinToNumber = (targetNumber: number, durationMs = 15000) => {
    if (isSpinningRef.current) return;
    isSpinningRef.current = true;
    setIsZoomed(false);
    setRevealedWinner(null);

    // Precise segment center targeting needle at top (-Math.PI / 2)
    const desiredAngle = -Math.PI / 2 - (targetNumber - 0.5) * segmentAngle;
    const targetNorm = ((desiredAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const currentNorm = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    let diff = targetNorm - currentNorm;
    if (diff <= 0) {
      diff += 2 * Math.PI;
    }

    // Realistic continuous 15-second spin: 26 full revolutions + exact diff
    const fullSpins = 26;
    const startAngle = currentAngle;
    const destinationAngle = startAngle + fullSpins * 2 * Math.PI + diff;
    const duration = 15000; // Strictly 15 seconds (15000ms)
    const startTime = performance.now();
    let lastTickSegment = -1;
    let lastTickTime = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Continuous smooth rotation with realistic physics easing curve
      const easeOut = 1 - Math.pow(1 - progress, 3.5);
      const angle = startAngle + (destinationAngle - startAngle) * easeOut;
      setCurrentAngle(angle);

      // Real 15-second countdown timer display
      const secondsLeft = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setSpinCountdown(secondsLeft);

      // Sound ticks as needle brushes each physical peg
      const normAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const ptrAngle = ((-Math.PI / 2 - normAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const currentSegment = Math.floor(ptrAngle / segmentAngle) + 1;

      if (currentSegment !== lastTickSegment && (now - lastTickTime > 30 || progress > 0.85)) {
        sound.playTick();
        lastTickSegment = currentSegment;
        lastTickTime = now;
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // EXACTLY 15 SECONDS FINISHED - WHEEL STOPS FULLY
        isSpinningRef.current = false;
        setCurrentAngle(destinationAngle);
        setSpinCountdown(0);
        sound.playWin();

        const currentSelection = selections[targetNumber];
        const winnerData = {
          number: targetNumber,
          userName: winnerInfo?.userName || currentSelection?.userName || 'Abbaa Tikkeetii',
          userPhone: winnerInfo?.userPhone || currentSelection?.userPhone,
          rank: winnerInfo?.rank,
          prize: winnerInfo?.prize,
        };

        // 95% ZOOM FOCUS DIRECTLY ON POINTER / ARROW AND WINNING NUMBER
        setIsZoomed(true);

        // REVEAL WINNER ONLY AFTER WHEEL COMES TO FULL 15-SECOND STOP
        setRevealedWinner(winnerData);

        confetti({
          particleCount: 220,
          spread: 90,
          origin: { y: 0.55 },
          colors: ['#eab308', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#ffffff'],
        });

        announceWinner(targetNumber, winnerData);

        if (onSpinEnd) {
          onSpinEnd(targetNumber);
        }
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  };


  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSpinning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const clickX = (e.clientX - rect.left) * scale - canvas.width / 2;
    const clickY = (e.clientY - rect.top) * scale - canvas.height / 2;
    const dist = Math.sqrt(clickX * clickX + clickY * clickY);

    // Center hub click
    if (dist < 48) {
      sound.playClick();
      return;
    }

    const radius = canvas.width / 2 - 40;
    if (dist > radius + 20) return;

    const clickAngle = Math.atan2(clickY, clickX);
    const normClick = ((clickAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const normWheel = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const relAngle = ((normClick - normWheel) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const clickedNum = Math.floor(relAngle / segmentAngle) + 1;
    const validNum = Math.min(Math.max(clickedNum, 1), 100);

    setInspectedNum(validNum);
    sound.playClick();
    if (onSelectNumber) onSelectNumber(validNum);
  };

  // 36 High-Power Radiant Multi-Color LED Bulbs around the machine perimeter ("iffaa cimaa fi baredaa")
  const numLeds = 36;
  const bulbPalettes = [
    { color: '#facc15', glow: 'rgba(250, 204, 21, 0.9)', name: 'gold' },
    { color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.9)', name: 'ruby' },
    { color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.9)', name: 'cyan' },
    { color: '#10b981', glow: 'rgba(16, 185, 129, 0.9)', name: 'emerald' },
    { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.9)', name: 'purple' },
    { color: '#f97316', glow: 'rgba(249, 115, 22, 0.9)', name: 'orange' },
  ];

  const leds = Array.from({ length: numLeds }, (_, idx) => {
    const angle = (idx / numLeds) * 2 * Math.PI;
    // Chasing marquee pattern
    const offset = (idx + lightPhase) % numLeds;
    const isLit = isSpinning ? offset % 2 === 0 : offset % 3 !== 0;
    const bulbInfo = bulbPalettes[idx % bulbPalettes.length];
    return { idx, angle, isLit, bulbInfo };
  });

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[500px] mx-auto select-none">
      {/* Top Illuminated Machine Crown Marquee / Active Status */}
      {isSpinning || (spinCountdown !== null && spinCountdown > 0) ? (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-full border-2 border-red-500/80 bg-gradient-to-r from-red-950 via-amber-950 to-red-950 px-5 py-2 shadow-[0_0_30px_rgba(239,68,68,0.6)] backdrop-blur animate-pulse">
          <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
          <span className="text-sm sm:text-base font-black uppercase tracking-wider text-yellow-300 drop-shadow-[0_1px_8px_rgba(245,158,11,0.8)]">
            ⏱️ NAANNA'AA JIRA: {spinCountdown ?? 15}s (15s Spin)
          </span>
          <span className="text-amber-300 animate-spin text-sm">✦</span>
        </div>
      ) : !isSpinning && revealedWinner ? (
        <div className="mb-2 flex flex-col items-center justify-center rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-neutral-950 via-amber-950 to-neutral-950 px-5 py-2 shadow-[0_0_35px_rgba(250,204,21,0.7)] backdrop-blur text-center animate-in zoom-in-95 duration-200">
          <span className="text-[11px] font-black tracking-widest uppercase text-yellow-400">
            🎉 CONGRATULATIONS! / BAGA GAMMADDAN! 🎉
          </span>
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-white">
              LAKK #{revealedWinner.number}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-400">
              • {revealedWinner.userName}
            </span>
            {revealedWinner.prize && (
              <span className="font-mono text-xs sm:text-sm font-black text-yellow-300 bg-yellow-400/20 px-2.5 py-0.5 rounded-lg border border-yellow-400/50 shadow-sm">
                💰 {revealedWinner.prize.toLocaleString()} ETB
              </span>
            )}
          </div>
          {revealedWinner.userPhone && (
            <span className="text-xs font-mono font-bold text-amber-300">
              Bilbila: {revealedWinner.userPhone}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-full border-2 border-amber-400/60 bg-gradient-to-r from-neutral-950 via-amber-950/80 to-neutral-950 px-4 py-1.5 shadow-[0_0_25px_rgba(245,158,11,0.45)] backdrop-blur">
          <span className="text-amber-300 animate-pulse text-sm">✦</span>
          <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_1px_8px_rgba(245,158,11,0.6)]">
            CARRAA KEESSAN YAALAA (1–100)
          </span>
          <span className="text-amber-300 animate-pulse text-sm">✦</span>
        </div>
      )}

      {/* Zoom / View Controller when winner is revealed */}
      {revealedWinner && !isSpinning && (
        <div className="mb-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/70 bg-gradient-to-r from-yellow-500/20 via-amber-500/30 to-yellow-500/20 px-3.5 py-1 text-xs font-black text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.3)] hover:border-yellow-300 hover:scale-105 transition cursor-pointer"
          >
            <span>{isZoomed ? '🔍 Zoom 95% Dhaabi (Full View)' : '🔍 95% Zoom Xiyya Irra (Zoom In)'}</span>
          </button>
        </div>
      )}

      {/* Outer Glowing Radiant Atmosphere & Wheel Stage with 95% Live Zoom Focus on Winning Number & Needle */}
      <div
        style={{
          transformOrigin: '50% 9%',
          transform: isZoomed ? 'scale(1.95) translateY(42px)' : 'scale(1)',
          transition: 'transform 850ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative flex items-center justify-center w-full aspect-square max-w-[450px] sm:max-w-[480px] z-10"
      >
        {/* Dynamic Multi-Color Conic/Radial Glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/40 via-rose-500/35 to-cyan-500/40 blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-r from-yellow-400/30 via-amber-500/35 to-purple-600/30 blur-2xl pointer-events-none" />
        <div className="absolute inset-6 rounded-full border-2 border-yellow-400/40 shadow-[0_0_60px_rgba(250,204,21,0.45)] pointer-events-none" />

        {/* 4 Corner Sparkling Cross Glints */}
        <span className="absolute -top-1 -left-1 text-yellow-300/80 text-lg animate-ping pointer-events-none">✦</span>
        <span className="absolute -top-1 -right-1 text-cyan-300/80 text-lg animate-ping pointer-events-none [animation-delay:400ms]">✦</span>
        <span className="absolute -bottom-1 -left-1 text-emerald-300/80 text-lg animate-ping pointer-events-none [animation-delay:800ms]">✦</span>
        <span className="absolute -bottom-1 -right-1 text-amber-300/80 text-lg animate-ping pointer-events-none [animation-delay:1200ms]">✦</span>

        {/* 95% Live Stream Zoom Target Spotlight directly on Winning Needle & Number ("bota lak bahe bicha hamulatu") */}
        {isZoomed && revealedWinner && (
          <div className="absolute top-1 z-40 flex flex-col items-center justify-center pointer-events-none animate-in zoom-in-95 duration-500">
            <div className="relative flex flex-col items-center">
              {/* Radiant Lens Frame centered over the pointer needle and the exact winning segment */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-yellow-400 bg-yellow-400/20 shadow-[0_0_50px_rgba(250,204,21,1)] ring-4 ring-amber-400/60 animate-pulse flex items-center justify-center">
                <span className="text-3xl sm:text-4xl font-black font-mono text-white drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">
                  {revealedWinner.number}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 rounded-full border-2 border-yellow-300 bg-neutral-950/95 px-3 py-0.5 shadow-2xl backdrop-blur">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] sm:text-xs font-black uppercase text-yellow-300 tracking-wider">
                  XIYYA CAARAA: #{revealedWinner.number}
                </span>
              </div>
            </div>
          </div>
        )}


        {/* 36 High-Intensity LED Bulbs along outer machine circumference */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {leds.map((led) => {
            const rPercent = 48.8; // Exactly aligns with outer bezel ring
            const leftPercent = 50 + Math.cos(led.angle) * rPercent;
            const topPercent = 50 + Math.sin(led.angle) * rPercent;
            const isLit = led.isLit;
            const { color, glow } = led.bulbInfo;

            return (
              <div
                key={led.idx}
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: isLit ? color : '#18181b',
                  boxShadow: isLit
                    ? `0 0 22px ${glow}, 0 0 45px ${glow}, 0 0 70px ${glow}, inset 0 0 8px #ffffff`
                    : 'inset 0 0 4px #000000',
                }}
                className={`absolute h-4 w-4 sm:h-4.5 sm:w-4.5 rounded-full border-2 border-white/90 transition-all duration-100 ${
                  isLit ? 'scale-135 ring-4 ring-white/95 z-20 animate-pulse' : 'opacity-35 scale-90'
                }`}
              >
                {/* Micro specular lens flare point and radiant center star */}
                {isLit && (
                  <>
                    <div className="absolute inset-0.5 rounded-full bg-white/80 blur-[0.5px] pointer-events-none" />
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-black leading-none pointer-events-none drop-shadow">
                      ✦
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* High-Definition Machine Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="relative z-10 w-[94%] h-[94%] max-h-[480px] max-w-[480px] sm:max-h-[520px] sm:max-w-[520px] drop-shadow-[0_15px_50px_rgba(245,158,11,0.7)] transition-all cursor-pointer hover:scale-[1.01]"
          onClick={handleCanvasClick}
          title="Carraa Keessan Yaalaa (1–100) - Tuqaa"
        />
      </div>

      {/* Radiant Pedestal Display Below Wheel - Fully Customized (100 / CONGRA) */}
      <div className="mt-3 flex items-center justify-between w-full max-w-[450px] rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-3 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono font-black text-base shadow-inner border ${
              isWinnerRevealed
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-emerald-300 ring-2 ring-emerald-400 animate-bounce'
                : isSpinning
                ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white border-amber-300 ring-2 ring-amber-400'
                : inspectedNum && claimedNumbers.includes(inspectedNum)
                ? 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-300 ring-2 ring-rose-400'
                : inspectedNum
                ? 'bg-gradient-to-br from-cyan-500 to-blue-700 text-white border-cyan-300'
                : 'bg-gradient-to-br from-yellow-400 via-amber-500 to-amber-600 text-neutral-950 border-amber-200 ring-2 ring-amber-400/60'
            }`}
          >
            {isWinnerRevealed ? `#${revealedWinner!.number}` : isSpinning ? `#${pointedNumber}` : inspectedNum ? `#${inspectedNum}` : '100'}
          </div>
          <div className="text-left">
            <span className="text-[10px] text-amber-400 font-black tracking-wider block uppercase leading-none">
              {isWinnerRevealed
                ? "🎉 BAGA GAMMADDAN (CONGRA)!"
                : isSpinning
                ? "GEENGOON NAANNA'AA JIRA..."
                : inspectedNum
                ? `TIKKEETII #${inspectedNum}`
                : "🎯 CARRAA KEE YAALI!"}
            </span>
            <span className="text-xs font-black text-white leading-tight block mt-0.5">
              {isWinnerRevealed
                ? `Mo'ataan Geengoo: Tikkeetii #${revealedWinner!.number}`
                : isSpinning
                ? "Carraa keessan eegaa..."
                : inspectedNum
                ? (claimedNumbers.includes(inspectedNum) ? "Tikkeetiin kun qabameera!" : "Tikkeetii kana qabachuu dandeessu!")
                : "Lakkoofsa 1–100 Filadhu (50 ETB)"}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black shadow-sm ${
              isWinnerRevealed
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : isSpinning
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-amber-400/20 border-amber-400/40 text-amber-300'
            }`}
          >
            {isSpinning ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                Naanna'aa Jira
              </>
            ) : isWinnerRevealed ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                CONGRA!
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Qophii (100)
              </>
            )}
          </span>
        </div>
      </div>

      {/* 1–100 Machine Quick Overview & Selector Strip */}
      <div className="mt-3 w-full max-w-[450px] rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3 backdrop-blur shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-amber-400">
              CARRAA KEESSAN YAALAA (1–100)
            </span>
            <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[9px] font-bold text-rose-300">
              {claimedNumbers.length}/100 Qabameera
            </span>
          </div>
          <span className="text-[10px] text-neutral-400">
            Lakkoofsa filachuuf tuqaa
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-amber-500/40">
          {Array.from({ length: 100 }, (_, idx) => idx + 1).map((num) => {
            const isTaken = claimedNumbers.includes(num);
            const isWin = isWinnerRevealed && revealedWinner?.number === num;
            const isUser = userTickets.includes(num);
            const isSelected = inspectedNum === num || pointedNumber === num;
            const selection = selections[num];

            return (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setInspectedNum(num);
                  sound.playClick();
                  if (onSelectNumber) onSelectNumber(num);
                }}
                title={
                  isWin
                    ? `Mo'ataa: #${num}`
                    : isUser
                    ? `Kan keessan: #${num}`
                    : isTaken
                    ? `Qabameera: #${num} (${selection?.userName || 'Qabameera'})`
                    : `Banaa: #${num}`
                }
                className={`flex-shrink-0 flex flex-col items-center justify-center w-8 h-10 rounded-lg text-xs font-mono font-black transition-all ${
                  isWin
                    ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-neutral-950 ring-2 ring-yellow-400 shadow-md scale-105'
                    : isUser
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white ring-1 ring-emerald-400'
                    : isTaken
                    ? 'bg-gradient-to-b from-rose-600/50 to-rose-950/80 border border-rose-500/60 text-rose-200'
                    : 'bg-neutral-900 border border-neutral-700/60 text-white hover:border-amber-400 hover:bg-neutral-800'
                } ${isSelected ? 'ring-2 ring-cyan-400 scale-105' : ''}`}
              >
                <span>{num}</span>
                <span className="text-[8px] leading-none opacity-80">
                  {isWin ? '★' : isUser ? '✔' : isTaken ? '●' : '○'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
