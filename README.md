Redis Visualizer
=====================

Redis visualizer is an utility to sample and visualise keys in your Redis instance.
It was insprired by the command line redis-sampler tool (https://github.com/antirez/redis-sampler),
with the goal to provide better user interface.

Using it is pretty straightforward, run it using:

`./redis-visualize.js`

This will start a webserver on port 8079, and you can connect to it using
your web browser, where you'll be able to specify address and port of the actual
Redis host and start sampling.

Similar keys are automatically clustered using regular expressions run on the key
itself, and you're free to modify the regexes to customize the clustering.
