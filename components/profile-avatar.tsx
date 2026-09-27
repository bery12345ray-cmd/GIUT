'use client';
import {useState} from 'react';
import Giuti from './giuti';
import type {AvatarSkin, Profile} from '@/lib/model';

export function ProfileAvatar({user}: {user: Pick<Profile, 'avatarSkin' | 'avatarUrl' | 'nickname'>}) {
  const [failed, setFailed] = useState(false);
  return user.avatarSkin === 'social' && user.avatarUrl && !failed
    ? <img className="giut-profile-image" src={user.avatarUrl} alt={user.nickname + ' 프로필'} referrerPolicy="no-referrer" onError={() => setFailed(true)}/>
    : <Giuti pose={user.avatarSkin === 'social' ? 'wave' : user.avatarSkin || 'wave'} label={user.nickname + '의 기웃이'}/>;
}
export function AvatarPicker({value, onChange, user}: {value: AvatarSkin; onChange: (value: AvatarSkin) => void; user: Profile | null}) {
  const options: {value: AvatarSkin; label: string}[] = [{value: 'wave', label: '반가운 기웃이'}, {value: 'explore', label: '탐험 기웃이'}, {value: 'love', label: '하트 기웃이'}];
  if (user?.avatarUrl) options.push({value: 'social', label: '소셜 프로필'});
  return <fieldset className="avatar-picker"><legend>나의 프로필</legend><div>{options.map(option => <label key={option.value} className={value === option.value ? 'selected' : ''}>
    <input type="radio" name="avatarSkin" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)}/>
    <span className="avatar-preview"><ProfileAvatar user={{nickname: option.label, avatarSkin: option.value, avatarUrl: user?.avatarUrl || null}}/></span><span>{option.label}</span>
  </label>)}</div></fieldset>;
}
