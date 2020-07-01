/* eslint-disable react/prop-types */
import React, { useState, useRef } from "react";

import _uniqueId from "lodash/uniqueId";
import ToggleablePanel from "./ToggleablePanel";
import HelpPanel from "./HelpPanel";

const CouplingController = props => {
  const { dispatch, state, stats } = props;
  const {
    couplingConfig: { couplingAvailable, shown, minRatio }
  } = state;
  console.log(stats);
  const {
    coupling: { bucket_count, bucket_size, first_bucket_start }
  } = stats;

  const bucketDays = bucket_size / (24 * 60 * 60);

  const { current: sliderId } = useRef(_uniqueId("coupling-controller-"));

  // TODO: debounce slider?  Tried using 'onInput' but 'onChange' fires on every change anyway

  if (!couplingAvailable) {
    return (
      <div>
        <p>(no coupling data in source)</p>
      </div>
    );
  }

  const showButton = shown ? (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "setShowCoupling",
          payload: false
        })
      }
    >
      Hide coupling
    </button>
  ) : (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "setShowCoupling",
          payload: true
        })
      }
    >
      Show coupling
    </button>
  );

  return (
    <div>
      {showButton}
      <ToggleablePanel title="coupling controls" showInitially={false}>
        <HelpPanel>
          <p>
            Temporal coupling is based on git history - two files which
            regularly change on the same day, may well have some kind of
            coupling - explicit or implicit
          </p>
          <p>
            The current calculation is fairly simple:
            <br />
            For each file, find what days it has changed in git.
            <br />
            Then count any other file which changes on some of those days.
            <br />
            For example if foo.rs changes on 20 days, and bar.rs changes on 18
            of those days, it will show up as a coupling of 18/20 or 0.9.
            <br />
          </p>
          <p>
            This is a one-way relationship - foo.rs <i>may</i> have coupling
            that means if bar.rs changes, foo.rs also has to change. The inverse
            may not be true - bar.rs might change on 100 other days as well!
          </p>
          <p>
            Be aware this can easily have false positives! For example, if
            bar.rs is changed extremely regularly, it will look like a lot of
            other files are coupled to it! You should probably consider
            excluding bar.rs from your initial scan - it's probably not normal
            source code. (there is no way to ignore it in the explorer
            currently)
          </p>
          <p>Note there are some limits on coupling data stored, for sanity:</p>
          <p>
            Coupling is calculated in "buckets" of {bucketDays} days each, so
            you can see coupling change over time. If you have multiple buckets
            selected, the changes are averaged. Buckets will be shown on the
            timescale below soon!
          </p>
          <p>
            Coupling data is only stored for files with 10 changes in a coupling
            bucket (by default, this is configurable)
          </p>
          <p>
            Coupling data is only stored if a ratio of 0.25 is observed (by
            default, this is configurable)
          </p>
        </HelpPanel>

        <label htmlFor={sliderId}>
          Coupling Ratio: &nbsp;
          {minRatio.toFixed(2)}
          <input
            type="range"
            min="0.25"
            max="1.0"
            step="0.01"
            value={minRatio}
            onChange={evt => {
              const value = Number.parseFloat(evt.target.value);

              dispatch({ type: "setMinCouplingRatio", payload: value });
            }}
          />
        </label>
      </ToggleablePanel>
    </div>
  );
};

export default CouplingController;
