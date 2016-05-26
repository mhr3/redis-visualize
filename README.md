# Redis Visualizer

Redis visualizer is an utility to sample and visualise keys in your Redis instance.
It was insprired by the command line redis-sampler tool (https://github.com/antirez/redis-sampler),
with the goal to provide better user interface.

Using it is pretty straightforward, install the package globally with:

`npm install -g redis-visualize`

And run it using:

`redis-visualize`

This will start a webserver on port 8079, and you can connect to it using
your web browser, where you'll be able to specify address, port and password of the actual
Redis host and start sampling.

Similar keys are automatically clustered using regular expressions run on the key
itself, and you're free to modify the regexes to customize the clustering.

It is highly recommended to run the utility in the same network as the redis host
and port forward just the HTTP port instead of port forwarding the redis port. This will
achieve much higher sampling throughput.

### Example output:

![Example output](https://github.com/mhr3/redis-visualize/wiki/images/example-output.png)
