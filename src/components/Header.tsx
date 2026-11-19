import type { JSX } from 'react'

export function Header(): JSX.Element {
  return (
    <header className="header">
      <img
        className="header__logo"
        src={`${import.meta.env.BASE_URL}logo.svg`}
        alt=""
        width={32}
        height={32}
      />
      <h1 className="header__title">Israel Rail Plans</h1>
      <span className="header__meta">
        <span className="header__badge" title={`Build ${__GIT_SHA__}`}>
          {__APP_VERSION__}
        </span>
        <span className="header__data-date" title="Date of the latest reference-update tag">
          Data from: {__REFERENCE_DATE__}
        </span>
      </span>
    </header>
  )
}
