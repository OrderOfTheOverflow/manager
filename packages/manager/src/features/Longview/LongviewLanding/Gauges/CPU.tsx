import { APIError } from 'linode-js-sdk/lib/types';
import { clamp, path, pathOr } from 'ramda';
import * as React from 'react';
import Typography from 'src/components/core/Typography';
import GaugePercent from 'src/components/GaugePercent';
import { pluralize } from 'src/utilities/pluralize';
import requestStats from '../../request';
import { CPU } from '../../request.types';
import { baseGaugeProps } from './common';

interface Props {
  clientAPIKey: string;
  lastUpdated?: number;
}

const LongviewGauge: React.FC<Props> = props => {
  const { clientAPIKey, lastUpdated } = props;

  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<APIError | undefined>();

  const [usedCPU, setUsedCPU] = React.useState<number | undefined>();
  const [numCores, setNumCores] = React.useState<number | undefined>();

  React.useEffect(() => {
    requestStats(clientAPIKey, 'getLatestValue', ['cpu', 'sysinfo'])
      .then(data => {
        setLoading(false);
        setError(undefined);

        const cores = path<number>(['SysInfo', 'cpu', 'cores'], data);

        // If we don't have the number of cores, we can't determine the value.
        if (!cores) {
          return;
        }

        setNumCores(cores);

        const used = sumCPUUsage(data.CPU);
        const normalizedUsed = normalizeValue(used, cores);
        setUsedCPU(normalizedUsed);
      })
      .catch(_ => {
        if (!usedCPU) {
          setError({
            reason: 'Error' // @todo: Error message?
          });
          setLoading(false);
        }
      });
  }, [lastUpdated]);

  return (
    <GaugePercent
      {...baseGaugeProps}
      // The MAX depends on the number of CPU cores. Default to 1 if cores
      // doesn't exist or is 0.
      max={typeof numCores === 'undefined' ? 1 : 100 * numCores}
      value={typeof usedCPU === 'undefined' ? 0 : usedCPU}
      innerText={innerText(usedCPU || 0, loading, error)}
      subTitle={
        <>
          <Typography>
            <strong>CPU</strong>
          </Typography>
          {!error && !loading && (
            <Typography>{pluralize('Core', 'Cores', numCores || 0)}</Typography>
          )}
        </>
      }
    />
  );
};

export default LongviewGauge;

// UTILITIES
export const sumCPUUsage = (CPUData: Record<string, CPU> = {}) => {
  let sum = 0;
  Object.keys(CPUData).forEach(key => {
    const cpu = CPUData[key];
    Object.keys(cpu).forEach(entry => {
      const val = pathOr(0, [entry, 0, 'y'], cpu);
      sum += val;
    });
  });
  return sum;
};

export const normalizeValue = (value: number, numCores: number) => {
  const clamped = clamp(0, 100 * numCores)(value);
  const rounded = Math.round(clamped);
  return rounded;
};

export const innerText = (
  value: number,
  loading: boolean,
  error?: APIError
) => {
  if (error) {
    return error.reason;
  }

  if (loading) {
    return 'Loading...';
  }

  return `${value}%`;
};